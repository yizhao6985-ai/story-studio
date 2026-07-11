import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

export function normalizeWorkPath(workPath: string): string {
  return resolve(workPath.trim());
}

export function workDataKey(workPath: string): string {
  return createHash("sha256")
    .update(normalizeWorkPath(workPath))
    .digest("hex")
    .slice(0, 16);
}

export function workUserDataDir(
  userDataRoot: string,
  workPath: string,
): string {
  return join(userDataRoot, "works", workDataKey(workPath));
}

export function workConversationsDir(
  userDataRoot: string,
  workPath: string,
): string {
  return join(workUserDataDir(userDataRoot, workPath), "conversations");
}

/** 全局 Agent 对话存储（所有作品共用，按 resourceId 隔离 thread）。 */
export function studioAgentDbPath(userDataRoot: string): string {
  return join(userDataRoot, "agent.sqlite");
}

/** 全局 Observability 存储。 */
export function studioObservabilityDbPath(userDataRoot: string): string {
  return join(userDataRoot, "observability.duckdb");
}

/** @deprecated 旧版按作品分库路径，仅用于数据迁移参考。 */
export function workAgentDbPath(
  userDataRoot: string,
  workPath: string,
): string {
  return join(workUserDataDir(userDataRoot, workPath), "agent.sqlite");
}

/** @deprecated 旧版按作品分库路径，仅用于数据迁移参考。 */
export function workObservabilityDbPath(
  userDataRoot: string,
  workPath: string,
): string {
  return join(workUserDataDir(userDataRoot, workPath), "observability.duckdb");
}
