import type { ActivityEntry } from "#agent/shared/work-loop/types.js";

const INTERNAL_THINK_MESSAGE_KIND = "internal_think" as const;
const ASSISTANT_TURN_MESSAGE_KIND = "assistant_turn" as const;
const TURN_ACTIVITY_MESSAGE_KIND = "turn_activity" as const;
const DELEGATE_TURN_MESSAGE_KIND = "delegate_turn" as const;

const STORY_STUDIO_MESSAGE_KIND_KEY = "story_studio_message_kind" as const;
const STORY_STUDIO_DELEGATE_SESSION_ID_KEY = "story_studio_delegate_session_id" as const;
const STORY_STUDIO_DELEGATE_TURN_KEY = "story_studio_delegate_turn" as const;
const STORY_STUDIO_ACTIVITY_LOG_KEY = "story_studio_activity_log" as const;
const STORY_STUDIO_SUBTASKS_KEY = "story_studio_subtasks" as const;

export type TurnSubTaskSummary = {
  id: string;
  intent: string;
  status: string;
};

type MessageLike = {
  id?: string;
  tool_calls?: unknown[];
  additional_kwargs?: Record<string, unknown>;
};

export function isTurnActivityMessage(message: MessageLike): boolean {
  const kwargs = message.additional_kwargs;
  if (!kwargs || typeof kwargs !== "object") return false;
  return kwargs[STORY_STUDIO_MESSAGE_KIND_KEY] === TURN_ACTIVITY_MESSAGE_KIND;
}

export function isInternalThinkMessage(message: MessageLike): boolean {
  const kwargs = message.additional_kwargs;
  return kwargs?.[STORY_STUDIO_MESSAGE_KIND_KEY] === INTERNAL_THINK_MESSAGE_KIND;
}

export function isAssistantTurnMessage(message: MessageLike): boolean {
  const kwargs = message.additional_kwargs;
  return kwargs?.[STORY_STUDIO_MESSAGE_KIND_KEY] === ASSISTANT_TURN_MESSAGE_KIND;
}

export function isDelegateTurnMessage(message: MessageLike): boolean {
  const kwargs = message.additional_kwargs;
  return kwargs?.[STORY_STUDIO_MESSAGE_KIND_KEY] === DELEGATE_TURN_MESSAGE_KIND;
}

export function buildDelegateTurnKwargs(input: {
  sessionId: string;
  turn: number;
}): Record<string, unknown> {
  return {
    [STORY_STUDIO_MESSAGE_KIND_KEY]: DELEGATE_TURN_MESSAGE_KIND,
    [STORY_STUDIO_DELEGATE_SESSION_ID_KEY]: input.sessionId,
    [STORY_STUDIO_DELEGATE_TURN_KEY]: input.turn,
  };
}

export function extractDelegateTurnMeta(message: MessageLike): {
  sessionId: string;
  turn: number;
} | null {
  if (!isDelegateTurnMessage(message)) return null;
  const kwargs = message.additional_kwargs;
  const sessionId = kwargs?.[STORY_STUDIO_DELEGATE_SESSION_ID_KEY];
  const turn = kwargs?.[STORY_STUDIO_DELEGATE_TURN_KEY];
  if (typeof sessionId !== "string" || typeof turn !== "number") return null;
  return { sessionId, turn };
}

export function buildAssistantTurnKwargs(input: {
  activityLog: ActivityEntry[];
  subtasks: TurnSubTaskSummary[];
}): Record<string, unknown> {
  return {
    [STORY_STUDIO_MESSAGE_KIND_KEY]: ASSISTANT_TURN_MESSAGE_KIND,
    [STORY_STUDIO_ACTIVITY_LOG_KEY]: input.activityLog,
    [STORY_STUDIO_SUBTASKS_KEY]: input.subtasks,
  };
}

export function buildInternalThinkKwargs(): Record<string, unknown> {
  return {
    [STORY_STUDIO_MESSAGE_KIND_KEY]: INTERNAL_THINK_MESSAGE_KIND,
  };
}

export function extractTurnMeta(message: MessageLike): {
  activityLog: ActivityEntry[];
  subtasks: TurnSubTaskSummary[];
} | null {
  const kwargs = message.additional_kwargs;
  if (!kwargs) return null;

  const activityLog = kwargs[STORY_STUDIO_ACTIVITY_LOG_KEY];
  const subtasks = kwargs[STORY_STUDIO_SUBTASKS_KEY];
  if (!Array.isArray(activityLog) && !Array.isArray(subtasks)) {
    return null;
  }

  return {
    activityLog: Array.isArray(activityLog) ? (activityLog as ActivityEntry[]) : [],
    subtasks: Array.isArray(subtasks) ? (subtasks as TurnSubTaskSummary[]) : [],
  };
}
