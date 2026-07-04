import { AIMessage, type BaseMessage } from "@langchain/core/messages";

import type { AgentStateType } from "#agent/graph/state.js";
import { createWorkspaceTools } from "#agent/tools/workspace.js";
import {
  toolsForMode,
  type ToolName,
} from "#agent/shared/work-loop/tool-gate.js";

export function getLastAiMessage(messages: BaseMessage[]): AIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (AIMessage.isInstance(message)) return message;
  }
  return null;
}

export function filterToolsByMode(
  allTools: ReturnType<typeof createWorkspaceTools>,
  mode: AgentStateType["mode"],
) {
  const allowed = new Set(toolsForMode(mode));
  return allTools.filter((t) => allowed.has(t.name as ToolName));
}
