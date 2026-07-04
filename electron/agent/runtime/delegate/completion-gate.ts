import type { ActivityEntry } from "#agent/shared/work-loop/types.js";

export type SessionOutcome = {
  hasArtifact: boolean;
  artifactPaths: string[];
  cumulativeActivityLog: ActivityEntry[];
};

const ARTIFACT_STAGES = new Set<ActivityEntry["stage"]>(["act", "verify"]);

export function hasSuccessfulArtifact(activityLog: ActivityEntry[]): boolean {
  return activityLog.some(
    (entry) => entry.status === "done" && ARTIFACT_STAGES.has(entry.stage),
  );
}

export function collectArtifactsFromActivityLog(
  activityLog: ActivityEntry[],
): string[] {
  const paths = new Set<string>();
  for (const entry of activityLog) {
    if (entry.status !== "done") continue;
    if (!ARTIFACT_STAGES.has(entry.stage)) continue;
    if (entry.path?.trim()) paths.add(entry.path.trim());
  }
  return [...paths];
}

export function mergeSessionOutcome(
  previous: SessionOutcome,
  activityLog: ActivityEntry[],
): SessionOutcome {
  const cumulativeActivityLog = [...previous.cumulativeActivityLog, ...activityLog];
  const artifactPaths = [
    ...new Set([
      ...previous.artifactPaths,
      ...collectArtifactsFromActivityLog(activityLog),
    ]),
  ];
  return {
    hasArtifact:
      artifactPaths.length > 0 || hasSuccessfulArtifact(cumulativeActivityLog),
    artifactPaths,
    cumulativeActivityLog,
  };
}

export function createInitialSessionOutcome(): SessionOutcome {
  return {
    hasArtifact: false,
    artifactPaths: [],
    cumulativeActivityLog: [],
  };
}

export function evaluateObjectiveCompletion(outcome: SessionOutcome): {
  passed: boolean;
  reason: string;
} {
  if (!outcome.hasArtifact) {
    return { passed: false, reason: "尚未产生可验证的文件变更或创建" };
  }
  if (outcome.artifactPaths.length > 0) {
    return {
      passed: true,
      reason: `已产出：${outcome.artifactPaths.join("、")}`,
    };
  }
  return { passed: true, reason: "已有成功的写入或验证记录" };
}
