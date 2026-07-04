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
import { messageContentToText } from "../messages/content.js";
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

export async function runLocalAgent(
  input: AgentRunInput,
): Promise<AgentRunResult> {
  activeRunAbort?.abort();
  activeRunAbort = new AbortController();

  await prepareConversationStore(input.workPath);
  const graph = await getWorkGraph(input.workPath);

  const config = {
    configurable: { thread_id: input.conversationId },
    signal: activeRunAbort.signal,
  };

  const manageActivityEmitter = input.manageActivityEmitter !== false;
  const seenStepIds = new Set<string>();
  const lastSubtasksJson = { value: "" };

  try {
    if (manageActivityEmitter) {
      setAgentActivityEmitter(
        (input.onActivity as
          | ((event: DelegateActivityEvent) => void)
          | undefined) ?? null,
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
    const lastAi = [...messages]
      .reverse()
      .find((m) => m._getType?.() === "ai" || m.type === "ai");
    const reply =
      typeof lastAi?.content === "string"
        ? lastAi.content
        : messageContentToText(lastAi?.content) || "（无回复）";

    const workLoop = values.workLoop as WorkLoopState | undefined;
    let activityLog = workLoop?.activityLog ?? [];
    if (activityLog.length === 0 && lastAi) {
      const meta = extractTurnMeta(
        lastAi as { additional_kwargs?: Record<string, unknown> },
      );
      if (meta?.activityLog.length) {
        activityLog = meta.activityLog;
      }
    }
    const subtasks = summarizeSubtasks(
      workLoop ? finalizeSubtasksOnCompletion(workLoop) : workLoop,
    );

    if (subtasks.length > 0) {
      emitAgentActivity({ type: "subtasks", subtasks });
    }

    await maybeAutoTitleConversation({
      workPath: input.workPath,
      conversationId: input.conversationId,
      userMessage: input.message,
      assistantReply: reply,
    });

    emitAgentActivity({ type: "done", reply });

    return {
      reply,
      activityLog,
      subtasks,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("abort")) {
      emitAgentActivity({ type: "error", message });
    }
    throw error;
  } finally {
    if (manageActivityEmitter) {
      setAgentActivityEmitter(null);
    }
  }
}

export function cancelLocalAgent(): void {
  activeRunAbort?.abort();
  activeRunAbort = null;
}
