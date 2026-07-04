import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import type { AgentMode } from "../../../src/lib/story/types.js";
import { getSelectedChatModel } from "../../settings/store.js";
import { formatSummaryInjection } from "#agent/nodes/compact-context/prompt.js";
import { buildSynthesizeSystemPrompt } from "#agent/nodes/synthesize/prompt.js";
import type { AgentStateType } from "#agent/graph/state.js";
import { createInitialWorkLoop } from "#agent/shared/work-loop/types.js";
import { messageContentToText } from "./content.js";
import {
  isAssistantTurnMessage,
  isInternalThinkMessage,
  isTurnActivityMessage,
} from "./turn-meta.js";
export const CONTEXT_COMPACT_THRESHOLD = 0.65;
export const CONTEXT_WARN_THRESHOLD = 0.6;
export const CONTEXT_CRITICAL_THRESHOLD = 0.85;
export const RECENT_VISIBLE_TURNS = 5;
export const MIN_MESSAGES_BEFORE_SUMMARY = 8;

export const RESERVED_OUTPUT_TOKENS = 8192;
export const RESERVED_TOOLS_TOKENS = 3000;
export const DEFAULT_MODEL_CONTEXT_TOKENS = 128_000;

const MODEL_CONTEXT_TOKENS: Record<string, number> = {
  default: DEFAULT_MODEL_CONTEXT_TOKENS,
};

export type ContextUsageSnapshot = {
  modelContextTokens: number;
  estimatedInputTokens: number;
  reservedOutputTokens: number;
  updatedAt: number;
};

export type ContextUsageResult = {
  percent: number;
  usedTokens: number;
  budgetTokens: number;
  hasSummary: boolean;
  modelLabel?: string;
};

export function getModelContextTokens(modelId: string): number {
  return MODEL_CONTEXT_TOKENS[modelId] ?? MODEL_CONTEXT_TOKENS.default!;
}

export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

export function estimateMessageTokens(message: BaseMessage): number {
  let tokens = estimateTokensFromText(messageContentToText(message.content));

  const toolCalls = (message as { tool_calls?: unknown[] }).tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    tokens += estimateTokensFromText(JSON.stringify(toolCalls));
  }

  const kwargs = message.additional_kwargs;
  if (kwargs && typeof kwargs === "object") {
    tokens += estimateTokensFromText(JSON.stringify(kwargs));
  }

  return tokens;
}

export function estimateMessagesTokens(messages: BaseMessage[]): number {
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
}

function estimateSystemTokens(mode: AgentMode, workLoop = createInitialWorkLoop()): number {
  return estimateTokensFromText(buildSynthesizeSystemPrompt(mode, workLoop));
}

function findLastHumanIndex(messages: BaseMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (HumanMessage.isInstance(messages[i])) return i;
  }
  return -1;
}

export function findMessageIndexById(
  messages: BaseMessage[],
  messageId: string | null | undefined,
): number {
  if (!messageId) return -1;
  return messages.findIndex((message) => message.id === messageId);
}

/** 已完成轮次中仅保留 user + 最终 assistant，去掉 internal think / tool。 */
export function filterCompletedTurnVisibleMessages(
  messages: BaseMessage[],
): BaseMessage[] {
  return messages.filter((message) => {
    if (HumanMessage.isInstance(message)) return true;
    if (isAssistantTurnMessage(message)) return true;
    return false;
  });
}

export function findRecentWindowStartIndex(messages: BaseMessage[]): number {
  const humanIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (HumanMessage.isInstance(messages[i])) {
      humanIndices.push(i);
    }
  }

  if (humanIndices.length <= RECENT_VISIBLE_TURNS) return 0;
  return humanIndices[humanIndices.length - RECENT_VISIBLE_TURNS]!;
}

export function filterVisibleMessagesForSummary(
  messages: BaseMessage[],
): BaseMessage[] {
  return messages.filter((message) => {
    if (isTurnActivityMessage(message)) return false;
    if (HumanMessage.isInstance(message)) return true;
    if (isAssistantTurnMessage(message)) return true;
    return false;
  });
}

export function buildSummarySystemMessage(summary: string): SystemMessage {
  return new SystemMessage(formatSummaryInjection(summary));
}

export function computeInputBudget(
  modelContextTokens: number,
  mode: AgentMode,
  workLoop = createInitialWorkLoop(),
): number {
  return Math.max(
    0,
    modelContextTokens -
      RESERVED_OUTPUT_TOKENS -
      RESERVED_TOOLS_TOKENS -
      estimateSystemTokens(mode, workLoop),
  );
}

/** 从 checkpoint 选出将送入 LLM 的消息（不含 human 附件压平）。 */
export function selectMessagesForLlm(state: AgentStateType): BaseMessage[] {
  const filtered = (state.messages ?? []).filter(
    (message) => !isTurnActivityMessage(message),
  );

  const summaryCutoff = findMessageIndexById(
    filtered,
    state.summaryThroughMessageId,
  );
  const afterSummary =
    summaryCutoff >= 0 ? filtered.slice(summaryCutoff + 1) : filtered;

  const lastHumanIdx = findLastHumanIndex(afterSummary);
  if (lastHumanIdx < 0) {
    const withSummary = state.conversationSummary
      ? [buildSummarySystemMessage(state.conversationSummary), ...afterSummary]
      : afterSummary;
    return filterCompletedTurnVisibleMessages(withSummary);
  }

  const history = afterSummary.slice(0, lastHumanIdx);
  const currentTurn = afterSummary.slice(lastHumanIdx);
  const visibleHistory = filterCompletedTurnVisibleMessages(history);

  const parts: BaseMessage[] = [];
  if (state.conversationSummary) {
    parts.push(buildSummarySystemMessage(state.conversationSummary));
  }
  parts.push(...visibleHistory, ...currentTurn);
  return parts;
}

export function buildContextUsageSnapshot(
  state: AgentStateType,
  extraMessages: BaseMessage[] = [],
): ContextUsageSnapshot {
  const modelId = getSelectedChatModel();
  const modelContextTokens = getModelContextTokens(modelId);
  const llmMessages = selectMessagesForLlm({
    ...state,
    messages: [...(state.messages ?? []), ...extraMessages],
  });
  const estimatedInputTokens =
    estimateSystemTokens(state.mode, state.workLoop ?? createInitialWorkLoop()) +
    estimateMessagesTokens(llmMessages);

  return {
    modelContextTokens,
    estimatedInputTokens,
    reservedOutputTokens: RESERVED_OUTPUT_TOKENS,
    updatedAt: Date.now(),
  };
}

export function snapshotToUsageResult(
  snapshot: ContextUsageSnapshot,
  hasSummary: boolean,
  modelLabel?: string,
): ContextUsageResult {
  const budgetTokens = Math.max(
    0,
    snapshot.modelContextTokens -
      snapshot.reservedOutputTokens -
      RESERVED_TOOLS_TOKENS,
  );
  const usedTokens = snapshot.estimatedInputTokens;
  const percent =
    budgetTokens > 0
      ? Math.min(100, Math.round((usedTokens / budgetTokens) * 100))
      : 100;

  return {
    percent,
    usedTokens,
    budgetTokens,
    hasSummary,
    modelLabel,
  };
}

export function estimateContextUsageResult(
  state: AgentStateType,
  extraMessages: BaseMessage[] = [],
  modelLabel?: string,
): ContextUsageResult {
  const snapshot = buildContextUsageSnapshot(state, extraMessages);
  return snapshotToUsageResult(
    snapshot,
    Boolean(state.conversationSummary),
    modelLabel,
  );
}

export function shouldCompactContext(state: AgentStateType): boolean {
  const messages = (state.messages ?? []).filter(
    (message) => !isTurnActivityMessage(message),
  );
  if (messages.length < MIN_MESSAGES_BEFORE_SUMMARY) return false;

  const usage = estimateContextUsageResult(state);
  return usage.percent / 100 >= CONTEXT_COMPACT_THRESHOLD;
}

export function messagesBeforeRecentWindow(messages: BaseMessage[]): BaseMessage[] {
  const start = findRecentWindowStartIndex(messages);
  if (start <= 0) return [];
  return messages.slice(0, start);
}

export function formatMessagesForSummaryPrompt(messages: BaseMessage[]): string {
  const lines: string[] = [];
  for (const message of filterVisibleMessagesForSummary(messages)) {
    if (HumanMessage.isInstance(message)) {
      lines.push(`用户：${messageContentToText(message.content).trim()}`);
      continue;
    }
    if (isAssistantTurnMessage(message)) {
      lines.push(`助手：${messageContentToText(message.content).trim()}`);
    }
  }
  return lines.filter(Boolean).join("\n\n");
}

export function isHistoryInternalMessage(message: BaseMessage): boolean {
  if (HumanMessage.isInstance(message)) return false;
  if (isAssistantTurnMessage(message)) return false;
  if (isTurnActivityMessage(message)) return false;
  if (isInternalThinkMessage(message)) return true;
  const kind = (message as { _getType?: () => string; type?: string })._getType?.() ??
    (message as { type?: string }).type;
  return kind === "tool";
}

export function findLastHumanIndexInMessages(messages: BaseMessage[]): number {
  return findLastHumanIndex(messages);
}
