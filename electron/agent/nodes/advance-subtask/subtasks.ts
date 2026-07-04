import type { SubTask, WorkLoopState } from "#agent/shared/work-loop/types.js";

export function applyPlannedSubtasks(
  workLoop: WorkLoopState,
  intents: string[],
): WorkLoopState {
  const subtasks: SubTask[] = intents.map((intent, index) => ({
    id: String(index + 1),
    intent: intent.trim(),
    status: index === 0 ? "in_progress" : "pending",
  }));

  return {
    ...workLoop,
    subtasks,
    currentSubtaskId: subtasks[0]?.id,
  };
}

export function advanceSubtask(workLoop: WorkLoopState): WorkLoopState {
  const currentId = workLoop.currentSubtaskId;
  if (!currentId) return workLoop;

  const subtasks = workLoop.subtasks.map((s) => {
    if (s.id === currentId && s.status !== "done") {
      return { ...s, status: "done" as const };
    }
    return s;
  });

  const next = subtasks.find((s) => s.status === "pending");
  if (next) {
    const updated = subtasks.map((s) =>
      s.id === next.id ? { ...s, status: "in_progress" as const } : s,
    );
    return {
      ...workLoop,
      subtasks: updated,
      currentSubtaskId: next.id,
      pinnedTargets: [],
      verifyAttempts: 0,
    };
  }

  return {
    ...workLoop,
    subtasks,
    currentSubtaskId: undefined,
    pinnedTargets: [],
  };
}

export function completeCurrentSubtaskAfterVerify(
  workLoop: WorkLoopState,
  writtenPath?: string,
): WorkLoopState {
  const currentId = workLoop.currentSubtaskId;
  if (!currentId) return workLoop;

  const subtasks = workLoop.subtasks.map((s) =>
    s.id === currentId
      ? { ...s, status: "done" as const, targetPath: writtenPath ?? s.targetPath }
      : s,
  );

  const next = subtasks.find((s) => s.status === "pending");
  const updated = next
    ? subtasks.map((s) =>
        s.id === next.id ? { ...s, status: "in_progress" as const } : s,
      )
    : subtasks;

  return {
    ...workLoop,
    subtasks: updated,
    currentSubtaskId: next?.id,
    pinnedTargets: [],
    verifyAttempts: 0,
  };
}

/** 运行结束时尚未 advance 的 in_progress 子任务，统一标记为 done（UI / 历史）。 */
export function finalizeSubtasksOnCompletion(
  workLoop: WorkLoopState,
): WorkLoopState {
  if (!workLoop.subtasks.some((s) => s.status === "in_progress")) {
    return workLoop;
  }

  return {
    ...workLoop,
    subtasks: workLoop.subtasks.map((s) =>
      s.status === "in_progress" ? { ...s, status: "done" as const } : s,
    ),
    currentSubtaskId: undefined,
  };
}
