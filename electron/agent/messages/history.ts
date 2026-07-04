import { messageContentToText } from "./content.js";
import {
  extractDelegateTurnMeta,
  extractTurnMeta,
  isAssistantTurnMessage,
  isInternalThinkMessage,
  isTurnActivityMessage,
} from "./turn-meta.js";
import type { ActivityEntry } from "#agent/shared/work-loop/types.js";
import type { TurnSubTaskSummary } from "./turn-meta.js";

export type HistoryChatMessage =
  | { role: "user"; text: string }
  | { role: "delegate"; text: string; turn: number }
  | {
      role: "assistant";
      text: string;
      activityLog?: ActivityEntry[];
      subtasks?: TurnSubTaskSummary[];
    };

function getMessageKind(message: unknown): string | undefined {
  const typed = message as { _getType?: () => string; type?: string };
  return typed._getType?.() ?? typed.type;
}

function buildAssistantHistoryMessage(message: unknown): HistoryChatMessage | null {
  const typed = message as { content?: unknown; additional_kwargs?: Record<string, unknown> };
  const text = messageContentToText(typed.content).trim();
  if (!text) return null;

  const meta = extractTurnMeta(typed);
  return {
    role: "assistant",
    text,
    ...(meta?.activityLog.length ? { activityLog: meta.activityLog } : {}),
    ...(meta?.subtasks.length ? { subtasks: meta.subtasks } : {}),
  };
}

function pickVisibleAssistantMessage(messages: unknown[]): HistoryChatMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as Parameters<typeof isAssistantTurnMessage>[0];
    if (isTurnActivityMessage(message)) continue;
    if (isInternalThinkMessage(message)) continue;
    if (isAssistantTurnMessage(message)) {
      return buildAssistantHistoryMessage(message);
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as Parameters<typeof isTurnActivityMessage>[0];
    if (isTurnActivityMessage(message)) continue;
    if (isInternalThinkMessage(message)) continue;
    const built = buildAssistantHistoryMessage(message);
    if (built) return built;
  }

  return null;
}

/** 将 checkpoint 消息转为 UI 历史：每轮用户消息对应一条 assistant 回复。 */
export function messagesToChatHistory(messages: unknown[]): HistoryChatMessage[] {
  const result: HistoryChatMessage[] = [];
  let i = 0;

  while (i < messages.length) {
    const message = messages[i];
    const kind = getMessageKind(message);

    if (kind === "human") {
      const text = messageContentToText(
        (message as { content?: unknown }).content,
      ).trim();
      if (text) {
        const delegateMeta = extractDelegateTurnMeta(
          message as { additional_kwargs?: Record<string, unknown> },
        );
        if (delegateMeta) {
          result.push({
            role: "delegate",
            text,
            turn: delegateMeta.turn,
          });
        } else {
          result.push({ role: "user", text });
        }
      }
      i++;
      continue;
    }

    if (kind !== "ai") {
      i++;
      continue;
    }

    const aiSegment: unknown[] = [];
    while (i < messages.length && getMessageKind(messages[i]) !== "human") {
      if (getMessageKind(messages[i]) === "ai") {
        aiSegment.push(messages[i]);
      }
      i++;
    }

    const assistant = pickVisibleAssistantMessage(aiSegment);
    if (assistant) {
      result.push(assistant);
    }
  }

  return result;
}
