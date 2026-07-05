import { AIMessage } from "@langchain/core/messages";

import { classifyLlmError, isContentPolicyError, toAgentRunError } from "../../../src/lib/llm-errors.js";
import { AGENT_ESCALATE_PREFIX, AGENT_RUN_DEGRADED_MESSAGE } from "./app-recovery.js";
import { emitAgentActivity } from "#agent/runtime/activity.js";

export function emitLlmLayerError(error: unknown): void {
  const classified = classifyLlmError(error);
  emitAgentActivity({
    type: "error",
    source: "llm",
    kind: classified.kind,
    message: classified.userMessage,
    suggestion: classified.suggestion,
    detail: classified.raw,
  });
}

export function buildContentPolicyFallbackMessage(
  error: unknown,
  additionalKwargs?: Record<string, unknown>,
): AIMessage {
  emitLlmLayerError(error);
  return new AIMessage({
    content: AGENT_RUN_DEGRADED_MESSAGE,
    additional_kwargs: additionalKwargs ?? {},
  });
}

export function buildContentPolicyEscalateReason(_error: unknown): string {
  return AGENT_ESCALATE_PREFIX;
}

export function handleContentPolicyOrThrow(
  error: unknown,
  node: string,
): never {
  throw toAgentRunError(error, { node });
}

export { isContentPolicyError };
