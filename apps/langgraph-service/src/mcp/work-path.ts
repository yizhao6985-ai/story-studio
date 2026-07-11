import type { RunnableConfig } from "@langchain/core/runnables";

export const WORK_PATH_HEADER = "x-story-studio-work-path";

export function getWorkPathFromConfig(
  config?: RunnableConfig,
): string | undefined {
  const workPath = config?.configurable?.workPath;
  return typeof workPath === "string" && workPath.trim()
    ? workPath.trim()
    : undefined;
}

export function requireWorkPathFromConfig(config?: RunnableConfig): string {
  const workPath = getWorkPathFromConfig(config);
  if (!workPath) {
    throw new Error("WORK_PATH_MISSING");
  }
  return workPath;
}
