import type { ActivityEntry, SubTask, WorkLoopState } from "#agent/shared/work-loop/types.js";

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
      thinkIdleRetries: 0,
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
    thinkIdleRetries: 0,
  };
}

function activityForSubtask(
  workLoop: WorkLoopState,
  subtaskId: string,
): ActivityEntry[] {
  return workLoop.activityLog.filter(
    (e) => e.subtaskId === subtaskId && e.stage !== "plan",
  );
}

function runHasSuccessfulArtifact(workLoop: WorkLoopState): boolean {
  return workLoop.activityLog.some(
    (e) =>
      (e.stage === "verify" || e.stage === "act") && e.status === "done",
  );
}

function allOtherSubtasksDone(
  workLoop: WorkLoopState,
  subtaskId: string,
): boolean {
  return workLoop.subtasks.every(
    (s) => s.id === subtaskId || s.status === "done",
  );
}

export function hasSuccessfulVerifyForSubtask(
  workLoop: WorkLoopState,
  subtaskId: string,
): boolean {
  return activityForSubtask(workLoop, subtaskId).some(
    (e) => e.stage === "verify" && e.status === "done",
  );
}

function resolveIncompleteSubtaskStatus(
  workLoop: WorkLoopState,
  subtask: SubTask,
): SubTask["status"] {
  const entries = activityForSubtask(workLoop, subtask.id);

  if (
    entries.some((e) => e.stage === "verify" && e.status === "done")
  ) {
    return "done";
  }

  const hasSuccessfulAct = entries.some(
    (e) => e.stage === "act" && e.status === "done",
  );
  const verifyErrors = entries.some(
    (e) => e.stage === "verify" && e.status === "error",
  );
  if (hasSuccessfulAct && !verifyErrors) {
    return "done";
  }
  if (hasSuccessfulAct && verifyErrors) {
    return "failed";
  }

  const hasReadOnlyProgress = entries.some(
    (e) =>
      (e.stage === "explore" || e.stage === "read" || e.stage === "target") &&
      e.status === "done",
  );
  if (hasReadOnlyProgress) {
    return "done";
  }

  // 末位或空步骤子任务：实际产出可能已在前序子任务中完成
  if (
    entries.length === 0 &&
    runHasSuccessfulArtifact(workLoop) &&
    allOtherSubtasksDone(workLoop, subtask.id)
  ) {
    return "done";
  }

  return "failed";
}

/** 运行结束时推断未完成子任务的最终状态，避免校验已通过却仍显示失败。 */
export function finalizeSubtasksOnCompletion(
  workLoop: WorkLoopState,
): WorkLoopState {
  const hasIncomplete = workLoop.subtasks.some(
    (s) => s.status === "in_progress" || s.status === "pending",
  );
  if (!hasIncomplete) {
    return { ...workLoop, currentSubtaskId: undefined };
  }

  const subtasks = workLoop.subtasks.map((s) => {
    if (s.status !== "in_progress" && s.status !== "pending") return s;
    const status = resolveIncompleteSubtaskStatus(workLoop, s);
    const verifyEntry = activityForSubtask(workLoop, s.id).find(
      (e) => e.stage === "verify" && e.status === "done",
    );
    const actEntry = activityForSubtask(workLoop, s.id).find(
      (e) => e.stage === "act" && e.status === "done",
    );
    return {
      ...s,
      status,
      targetPath: verifyEntry?.path ?? actEntry?.path ?? s.targetPath,
    };
  });

  return {
    ...workLoop,
    subtasks,
    currentSubtaskId: undefined,
  };
}
