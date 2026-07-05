/**
 * 本地 Agent run 调度（Story Studio desktop）
 */
import { HumanMessage } from "@langchain/core/messages";

import type { AgentMode } from "../../../src/lib/story/types.js";
import {
  prepareConversationStore,
  touchConversation,
} from "../../library/conversation-store.js";
import { maybeAutoTitleConversation } from "../../library/generate-conversation-title.js";
import {
  getLlmPreferences,
  getSelectedChatModel,
} from "../../settings/store.js";

import {
  emitAgentActivity,
  setAgentActivityEmitter,
  type AgentActivityEvent,
  type DelegateActivityEvent,
  type SubTaskSummary,
} from "./activity.js";
import {
  messagesToChatHistory,
  type HistoryChatMessage,
} from "../messages/history.js";
import { pickVisibleAssistantReply } from "../messages/history.js";
import {
  buildSynthesizeFallbackReply,
  EMPTY_ASSISTANT_REPLY,
  isEmptyAssistantReply,
} from "../nodes/synthesize/fallback.js";
import { extractTurnMeta } from "../messages/turn-meta.js";
import { finalizeSubtasksOnCompletion } from "../nodes/advance-subtask/subtasks.js";
import {
  estimateContextUsageResult,
  type ContextUsageResult,
} from "../messages/context-usage.js";
import type {
  ActivityEntry,
  WorkLoopState,
} from "../shared/work-loop/types.js";
import { getWorkGraph } from "./work-graph.js";
import {
  AGENT_RUN_TIMEOUT_ABORT,
  AGENT_RUN_TIMEOUT_MS,
  AGENT_USER_CANCEL_ABORT,
  classifyLlmError,
  isUserCancelError,
  toAgentRunError,
} from "../../../src/lib/llm-errors.js";
import { isLlmLayerError } from "../../../src/lib/agent-error-display.js";

let activeRunAbort: AbortController | null = null;

export type ChatMessage = HistoryChatMessage;

export type AgentRunResult = {
  reply: string;
  activityLog: ActivityEntry[];
  subtasks: SubTaskSummary[];
};

export type AgentRunInput = {
  workPath: string;
  conversationId: string;
  message: string;
  mode: AgentMode;
  humanMessageKwargs?: Record<string, unknown>;
  manageActivityEmitter?: boolean;
  onActivity?: (event: AgentActivityEvent) => void;
};

export type AgentContextUsageInput = {
  workPath: string;
  conversationId: string;
  mode: AgentMode;
  draftMessage?: string;
};

export { type ContextUsageResult } from "../messages/context-usage.js";

const NODE_STATUS: Record<string, AgentActivityEvent & { type: "status" }> = {
  routeTurn: { type: "status", status: "thinking" },
  planTasks: { type: "status", status: "planning" },
  think: { type: "status", status: "thinking" },
  executeTools: { type: "status", status: "executing" },
  synthesize: { type: "status", status: "synthesizing" },
  escalate: { type: "status", status: "synthesizing" },
};

export async function loadConversationMessages(input: {
  workPath: string;
  conversationId: string;
}): Promise<ChatMessage[]> {
  await prepareConversationStore(input.workPath);
  const graph = await getWorkGraph(input.workPath);
  const state = await graph.getState({
    configurable: { thread_id: input.conversationId },
  });
  return messagesToChatHistory(state.values?.messages ?? []);
}

export async function getAgentContextUsage(
  input: AgentContextUsageInput,
): Promise<ContextUsageResult> {
  await prepareConversationStore(input.workPath);
  const graph = await getWorkGraph(input.workPath);
  const state = await graph.getState({
    configurable: { thread_id: input.conversationId },
  });
  const values = state.values ?? {};
  const draft = input.draftMessage?.trim();
  const extraMessages = draft ? [new HumanMessage(draft)] : [];

  let modelLabel: string | undefined;
  try {
    const prefs = await getLlmPreferences();
    modelLabel = prefs.chatModels.find(
      (m) => m.id === getSelectedChatModel(),
    )?.label;
  } catch {
    modelLabel = undefined;
  }

  return estimateContextUsageResult(
    {
      messages: values.messages ?? [],
      workPath: values.workPath ?? input.workPath,
      mode: input.mode,
      workLoop: values.workLoop ?? null,
      turnRoute: values.turnRoute ?? null,
      conversationSummary: values.conversationSummary ?? null,
      summaryThroughMessageId: values.summaryThroughMessageId ?? null,
      contextUsage: values.contextUsage ?? null,
    },
    extraMessages,
    modelLabel,
  );
}

function syncWorkLoopActivity(
  workLoop: WorkLoopState | undefined,
  seenStepIds: Set<string>,
  lastSubtasksJson: { value: string },
): void {
  if (!workLoop) return;

  const subtasksJson = JSON.stringify(workLoop.subtasks ?? []);
  if (subtasksJson !== lastSubtasksJson.value) {
    lastSubtasksJson.value = subtasksJson;
    emitAgentActivity({
      type: "subtasks",
      subtasks: (workLoop.subtasks ?? []).map((s) => ({
        id: s.id,
        intent: s.intent,
        status: s.status,
      })),
    });
  }

  for (const entry of workLoop.activityLog ?? []) {
    if (seenStepIds.has(entry.id)) continue;
    seenStepIds.add(entry.id);
    emitAgentActivity({ type: "step", entry });
  }
}

function summarizeSubtasks(
  workLoop: WorkLoopState | undefined,
): SubTaskSummary[] {
  return (workLoop?.subtasks ?? []).map((s) => ({
    id: s.id,
    intent: s.intent,
    status: s.status,
  }));
}

function resolveRunReply(
  messages: unknown[],
  workLoop: WorkLoopState | undefined,
  streamedReply: string,
  mode: AgentMode,
): string {
  const picked = pickVisibleAssistantReply(messages);
  if (!isEmptyAssistantReply(picked)) return picked;

  const streamed = streamedReply.trim();
  if (streamed) return streamed;

  if (workLoop) {
    return buildSynthesizeFallbackReply(
      finalizeSubtasksOnCompletion(workLoop),
      mode,
    );
  }

  return EMPTY_ASSISTANT_REPLY;
}

export async function runLocalAgent(
  input: AgentRunInput,
): Promise<AgentRunResult> {
  activeRunAbort?.abort(AGENT_USER_CANCEL_ABORT);
  activeRunAbort = new AbortController();
  const runAbort = activeRunAbort;
  const runTimeoutId = setTimeout(() => {
    runAbort.abort(AGENT_RUN_TIMEOUT_ABORT);
  }, AGENT_RUN_TIMEOUT_MS);

  let terminalEventSent = false;
  const emitTerminalError = (error: unknown) => {
    if (terminalEventSent) return;
    const agentError = toAgentRunError(error);
    emitAgentActivity({
      type: "error",
      source: "llm",
      kind: agentError.kind,
      message: agentError.userMessage,
      suggestion: agentError.suggestion,
      detail: agentError.raw,
    });
    terminalEventSent = true;
  };

  await prepareConversationStore(input.workPath);
  const graph = await getWorkGraph(input.workPath);

  const config = {
    configurable: { thread_id: input.conversationId },
    signal: activeRunAbort.signal,
  };

  const manageActivityEmitter = input.manageActivityEmitter !== false;
  const seenStepIds = new Set<string>();
  const lastSubtasksJson = { value: "" };
  let streamedReply = "";

  try {
    if (manageActivityEmitter) {
      setAgentActivityEmitter((event) => {
        if (event.type === "reply_delta") {
          streamedReply += event.delta;
        }
        (
          input.onActivity as
            | ((event: DelegateActivityEvent) => void)
            | undefined
        )?.(event);
      });
    } else if (input.onActivity) {
      setAgentActivityEmitter(
        input.onActivity as (event: DelegateActivityEvent) => void,
      );
    }

    const stream = await graph.stream(
      {
        messages: [
          new HumanMessage({
            content: input.message,
            additional_kwargs: input.humanMessageKwargs ?? {},
          }),
        ],
        workPath: input.workPath,
        mode: input.mode,
      },
      { ...config, recursionLimit: 50, streamMode: "updates" },
    );

    for await (const update of stream) {
      for (const [nodeName, patch] of Object.entries(update)) {
        const status = NODE_STATUS[nodeName];
        if (status) emitAgentActivity(status);

        const typedPatch = patch as { workLoop?: WorkLoopState };
        if (typedPatch.workLoop) {
          syncWorkLoopActivity(
            typedPatch.workLoop,
            seenStepIds,
            lastSubtasksJson,
          );
        }
      }
    }

    await touchConversation(input.workPath, input.conversationId);

    const finalState = await graph.getState(config);
    const values = finalState.values ?? {};
    const messages = values.messages ?? [];

    const workLoop = values.workLoop as WorkLoopState | undefined;
    const finalizedWorkLoop = workLoop
      ? finalizeSubtasksOnCompletion(workLoop)
      : workLoop;
    const reply = resolveRunReply(
      messages,
      finalizedWorkLoop,
      streamedReply,
      input.mode,
    );

    let activityLog = finalizedWorkLoop?.activityLog ?? [];
    const lastAi = [...messages]
      .reverse()
      .find((m) => m._getType?.() === "ai" || m.type === "ai");
    if (activityLog.length === 0 && lastAi) {
      const meta = extractTurnMeta(
        lastAi as { additional_kwargs?: Record<string, unknown> },
      );
      if (meta?.activityLog.length) {
        activityLog = meta.activityLog;
      }
    }
    const subtasks = summarizeSubtasks(finalizedWorkLoop);

    if (subtasks.length > 0) {
      emitAgentActivity({ type: "subtasks", subtasks });
    }

    await maybeAutoTitleConversation({
      workPath: input.workPath,
      conversationId: input.conversationId,
      userMessage: input.message,
      assistantReply: reply,
    });

    emitAgentActivity({ type: "done", reply, subtasks });
    terminalEventSent = true;

    return {
      reply,
      activityLog,
      subtasks,
    };
  } catch (error) {
    if (isUserCancelError(error)) {
      throw error;
    }
    const classified = classifyLlmError(error);
    if (isLlmLayerError(classified, error)) {
      emitTerminalError(error);
    }
    throw toAgentRunError(error);
  } finally {
    clearTimeout(runTimeoutId);
    if (manageActivityEmitter) {
      setAgentActivityEmitter(null);
    }
  }
}

export function cancelLocalAgent(): void {
  activeRunAbort?.abort(AGENT_USER_CANCEL_ABORT);
  activeRunAbort = null;
}
