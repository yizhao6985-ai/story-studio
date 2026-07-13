import { mkdir, stat } from "node:fs/promises";
import { basename } from "node:path";

import {
  readWorkUserMeta,
  setWorkDisplayTitle,
} from "@story-studio/workspace-fs";
import type { WorkSnapshot } from "../../src/lib/story/types.js";

export async function loadWork(workPath: string): Promise<WorkSnapshot> {
  const meta = await readWorkUserMeta(workPath);
  return {
    workPath,
    manifest: {
      title: meta.displayTitle ?? (basename(workPath) || "未命名作品"),
    },
    revision: meta.revision ?? 0,
  };
}

export async function updateWorkTitle(
  workPath: string,
  title: string,
): Promise<void> {
  await setWorkDisplayTitle(workPath, title);
}

export async function initWorkspaceAtPath(
  workPath: string,
  title?: string,
): Promise<string> {
  await mkdir(workPath, { recursive: true });
  if (title?.trim()) {
    await setWorkDisplayTitle(workPath, title.trim());
  }
  return workPath;
}

export async function isWorkspace(workPath: string): Promise<boolean> {
  try {
    const info = await stat(workPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}
