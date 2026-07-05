import type { RequestContext } from "@mastra/core/request-context";

export function requireWorkPath(
  requestContext?: RequestContext,
): string {
  const workPath = requestContext?.get("workPath") as string | undefined;
  if (typeof workPath !== "string" || !workPath.trim()) {
    throw new Error("WORK_PATH_MISSING");
  }
  return workPath.trim();
}
