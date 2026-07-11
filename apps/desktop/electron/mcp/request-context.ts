import { AsyncLocalStorage } from "node:async_hooks";
import { resolve } from "node:path";

export type McpRequestContext = {
  workPath: string | null;
};

export const mcpRequestContext = new AsyncLocalStorage<McpRequestContext>();

export function getRequestWorkPath(): string | null {
  return mcpRequestContext.getStore()?.workPath ?? null;
}

export function assertRequestWorkPath(): string {
  const workPath = getRequestWorkPath()?.trim();
  if (!workPath) {
    throw new Error("NO_ACTIVE_WORKSPACE");
  }
  return assertAbsoluteWorkPath(workPath);
}

/** 作品库根目录必须是已存在的绝对路径。 */
export function assertAbsoluteWorkPath(workPath: string): string {
  const resolved = resolve(workPath.trim());
  if (!resolved.startsWith("/") && !/^[A-Za-z]:\\/.test(resolved)) {
    throw new Error("INVALID_WORKSPACE_PATH");
  }
  return resolved;
}
