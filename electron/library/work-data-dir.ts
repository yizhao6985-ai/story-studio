import { app } from "electron";
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
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

/** 本机用户数据：按作品路径哈希隔离 */
export function workUserDataDir(workPath: string): string {
  return join(app.getPath("userData"), "works", workDataKey(workPath));
}

export function workConversationsDir(workPath: string): string {
  return join(workUserDataDir(workPath), "conversations");
}

/** 作品级 LangGraph checkpoint（所有对话共用） */
export function workCheckpointPath(workPath: string): string {
  return join(workUserDataDir(workPath), "agent.sqlite");
}

/** 移除作品在本机的用户数据（不触碰作品目录本身） */
export async function removeWorkUserData(workPath: string): Promise<void> {
  await rm(workUserDataDir(workPath), { recursive: true, force: true });
}
