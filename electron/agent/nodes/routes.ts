import type { AgentStateType } from "#agent/graph/state.js";
import { hasActivityForSubtask } from "#agent/shared/work-loop/activity-log.js";
import {
  allSubtasksComplete,
  hasPendingSubtasks,
} from "#agent/shared/work-loop/types.js";

import { getLastAiMessage } from "./utils.js";

function shouldAdvanceAfterAskThink(state: AgentStateType): boolean {
  const workLoop = state.workLoop;
  if (!workLoop?.currentSubtaskId) return false;
  if (state.mode !== "ask" && state.mode !== "scheme") return false;
  if (!hasActivityForSubtask(workLoop, workLoop.currentSubtaskId)) return false;
  if (!hasPendingSubtasks(workLoop)) return false;
  const current = workLoop.subtasks.find((s) => s.id === workLoop.currentSubtaskId);
  return current?.status === "in_progress";
}

export function routeAfterRouteTurn(
  state: AgentStateType,
): "planTasks" | "synthesize" {
  return state.turnRoute === "direct" ? "synthesize" : "planTasks";
}

export function routeAfterThink(
  state: AgentStateType,
): "executeTools" | "synthesize" | "escalate" | "advanceSubtask" {
  if (state.workLoop?.escalateReason) return "escalate";

  const lastAi = getLastAiMessage(state.messages ?? []);
  const toolCalls = lastAi?.tool_calls ?? [];
  if (toolCalls.length > 0) return "executeTools";

  if (shouldAdvanceAfterAskThink(state)) return "advanceSubtask";

  return "synthesize";
}

export function routeAfterExecute(
  state: AgentStateType,
): "think" | "escalate" | "synthesize" {
  if (state.workLoop?.escalateReason) {
    if (state.workLoop.escalateReason.includes("步数已达上限")) {
      return "synthesize";
    }
    return "escalate";
  }
  if ((state.workLoop?.stepCount ?? 0) >= (state.workLoop?.maxSteps ?? 24)) {
    return "synthesize";
  }
  if (allSubtasksComplete(state.workLoop!)) {
    return "synthesize";
  }
  return "think";
}

export function routeAfterAdvance(
  state: AgentStateType,
): "think" | "synthesize" {
  if (allSubtasksComplete(state.workLoop!)) return "synthesize";
  return "think";
}
