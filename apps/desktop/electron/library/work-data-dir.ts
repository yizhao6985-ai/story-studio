import { app } from "electron";

import {
  normalizeWorkPath,
  workConversationsDir as sharedWorkConversationsDir,
  workUserDataDir as sharedWorkUserDataDir,
} from "@story-studio/shared/paths";

export { normalizeWorkPath };

function userDataRoot(): string {
  return app.getPath("userData");
}

export function workUserDataDir(workPath: string): string {
  return sharedWorkUserDataDir(userDataRoot(), workPath);
}

export function workConversationsDir(workPath: string): string {
  return sharedWorkConversationsDir(userDataRoot(), workPath);
}

export async function removeWorkUserData(workPath: string): Promise<void> {
  const { rm } = await import("node:fs/promises");
  await rm(workUserDataDir(workPath), { recursive: true, force: true });
}
