import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";
import { invokeStructured } from "#agent/llm/structured.js";
import { createChatModel } from "#agent/llm/chat-model.js";
import {
  buildContextUsageSnapshot,
  findRecentWindowStartIndex,
  formatMessagesForSummaryPrompt,
  messagesBeforeRecentWindow,
  shouldCompactContext,
} from "#agent/messages/context-usage.js";
import { isTurnActivityMessage } from "#agent/messages/turn-meta.js";
import {
  COMPACT_CONTEXT_SYSTEM_PROMPT,
} from "./prompt.js";
import { createInitialWorkLoop } from "#agent/shared/work-loop/types.js";
import { emitAgentActivity } from "#agent/runtime/activity.js";

const SummarySchema = z.object({
  summary: z
    .string()
    .min(1)
    .describe("结构化中文摘要，保留用户目标、决策、文件路径、未完成事项"),
  paths: z
    .array(z.string())
    .describe("对话中提到过的作品内相对路径，无则空数组"),
});

async function generateConversationSummary(
  previousSummary: string | null,
  messagesText: string,
  config: RunnableConfig,
): Promise<string> {
  const userParts = [
    previousSummary
      ? `已有摘要：\n${previousSummary.trim()}\n\n---\n\n待合并的新对话：`
      : "待摘要的对话：",
    messagesText,
  ];

  const llm = createChatModel({ temperature: 0.2 });
  const parsed = await invokeStructured(
    llm,
    SummarySchema,
    [
      new SystemMessage(COMPACT_CONTEXT_SYSTEM_PROMPT),
      new HumanMessage(userParts.join("\n")),
    ],
    { name: "compact_context", maxAttempts: 1 },
    config,
  );

  const pathBlock =
    parsed.paths.length > 0 ? `\n\n相关路径：${parsed.paths.join("、")}` : "";

  return `${parsed.summary.trim()}${pathBlock}`;
}

export async function compactContextNode(
  state: AgentStateType,
  config: RunnableConfig,
): Promise<AgentStatePatch> {
  const workLoop = state.workLoop ?? createInitialWorkLoop();
  const snapshotState = { ...state, workLoop };
  const patch: AgentStatePatch = {};

  if (!state.workLoop) {
    patch.workLoop = workLoop;
  }

  const filtered = (state.messages ?? []).filter(
    (message) => !isTurnActivityMessage(message),
  );

  if (!shouldCompactContext(snapshotState)) {
    return {
      ...patch,
      contextUsage: buildContextUsageSnapshot(snapshotState),
    };
  }

  const windowStart = findRecentWindowStartIndex(filtered);
  if (windowStart <= 0) {
    return {
      ...patch,
      contextUsage: buildContextUsageSnapshot(snapshotState),
    };
  }

  const toSummarize = messagesBeforeRecentWindow(filtered);
  const messagesText = formatMessagesForSummaryPrompt(toSummarize);
  if (!messagesText.trim()) {
    return {
      ...patch,
      contextUsage: buildContextUsageSnapshot(snapshotState),
    };
  }

  try {
    const summary = await generateConversationSummary(
      state.conversationSummary,
      messagesText,
      config,
    );
    const summaryThroughMessageId = filtered[windowStart - 1]?.id ?? null;

    emitAgentActivity({ type: "context_compacted" });

    const nextState = {
      ...snapshotState,
      conversationSummary: summary,
      summaryThroughMessageId,
    };

    return {
      ...patch,
      conversationSummary: summary,
      summaryThroughMessageId,
      contextUsage: buildContextUsageSnapshot(nextState),
    };
  } catch {
    return {
      ...patch,
      contextUsage: buildContextUsageSnapshot(snapshotState),
    };
  }
}
