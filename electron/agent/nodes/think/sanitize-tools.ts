import { AIMessage } from "@langchain/core/messages";

import { resolveToolName } from "#agent/shared/tooling.js";
import {
  toolsForMode,
  type ToolName,
} from "#agent/shared/work-loop/tool-gate.js";
import type { AgentMode } from "../../../../src/lib/story/types.js";

export function sanitizeThinkToolCalls(
  message: AIMessage,
  mode: AgentMode,
): AIMessage {
  const allowed = new Set(toolsForMode(mode));
  const calls = message.tool_calls ?? [];
  if (!calls.length) return message;

  const sanitized = calls.flatMap((call) => {
    const resolved = resolveToolName(call.name);
    if (resolved.kind !== "resolved") return [];
    if (!allowed.has(resolved.name as ToolName)) return [];
    return [{ ...call, name: resolved.name }];
  });

  if (
    sanitized.length === calls.length &&
    sanitized.every((call, i) => call.name === calls[i]?.name)
  ) {
    return message;
  }

  return new AIMessage({
    id: message.id,
    content: message.content,
    tool_calls: sanitized,
    additional_kwargs: message.additional_kwargs,
    usage_metadata: message.usage_metadata,
    response_metadata: message.response_metadata,
  });
}
