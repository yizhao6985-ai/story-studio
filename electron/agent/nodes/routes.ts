import type { AgentStateType } from "#agent/graph/state.js";
import { hasActivityForSubtask } from "#agent/shared/work-loop/activity-log.js";
import { hasSuccessfulVerifyForSubtask } from "./advance-subtask/subtasks.js";
import { TOOL_NAMES } from "#agent/shared/work-loop/tool-gate.js";
import {
  allSubtasksComplete,
  hasPendingSubtasks,
} from "#agent/shared/work-loop/types.js";

import { getLastAiMessage } from "./utils.js";

/** 当前子任务已有 tool 活动、仍有 pending、且写入已校验通过时可推进。 */
function shouldAdvanceAfterThink(state: AgentStateType): boolean {
  const workLoop = state.workLoop;
  if (!workLoop?.currentSubtaskId) return false;
  if (!hasActivityForSubtask(workLoop, workLoop.currentSubtaskId)) return false;
  if (!hasPendingSubtasks(workLoop)) return false;
  const current = workLoop.subtasks.find((s) => s.id === workLoop.currentSubtaskId);
  if (current?.status !== "in_progress") return false;

  if (state.mode === "normal" && workLoop.currentSubtaskId) {
    const subtaskId = workLoop.currentSubtaskId;
    const hasSuccessfulWrite = workLoop.activityLog.some(
      (e) =>
        e.subtaskId === subtaskId &&
        e.stage === "act" &&
        e.status === "done" &&
        (e.action === TOOL_NAMES.patch ||
          e.action === TOOL_NAMES.write ||
          e.action === TOOL_NAMES.create),
    );
    if (hasSuccessfulWrite && !hasSuccessfulVerifyForSubtask(workLoop, subtaskId)) {
      return false;
    }
  }

  return true;
}

function canRetryThink(workLoop: NonNullable<AgentStateType["workLoop"]>): boolean {
  return (
    (workLoop.thinkIdleRetries ?? 0) < (workLoop.maxThinkIdleRetries ?? 2)
  );
}

export function routeAfterRouteTurn(
  state: AgentStateType,
): "planTasks" | "synthesize" {
  return state.turnRoute === "direct" ? "synthesize" : "planTasks";
}

export function routeAfterThink(
  state: AgentStateType,
):
  | "executeTools"
  | "synthesize"
  | "escalate"
  | "advanceSubtask"
  | "think" {
  if (state.workLoop?.escalateReason) return "escalate";

  const workLoop = state.workLoop;
  const lastAi = getLastAiMessage(state.messages ?? []);
  const toolCalls = lastAi?.tool_calls ?? [];

  if (toolCalls.length > 0) return "executeTools";

  if (!workLoop?.subtasks.length) {
    return "synthesize";
  }

  if (shouldAdvanceAfterThink(state)) {
    return "advanceSubtask";
  }

  if (!allSubtasksComplete(workLoop)) {
    const currentId = workLoop.currentSubtaskId;
    const currentHasActivity = currentId
      ? hasActivityForSubtask(workLoop, currentId)
      : false;

    if (hasPendingSubtasks(workLoop) && currentHasActivity) {
      return "advanceSubtask";
    }

    if (canRetryThink(workLoop)) {
      return "think";
    }
  }

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
