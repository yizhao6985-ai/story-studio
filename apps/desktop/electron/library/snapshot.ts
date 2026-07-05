import { mkdir, stat } from "node:fs/promises";
import { basename } from "node:path";

import {
  readWorkUserMeta,
  setWorkDisplayTitle,
} from "@story-studio/workspace-fs";
import type { WorkSnapshot } from "../../src/lib/story/types.js";
import { prepareConversationStore } from "./conversation-store.js";
import { readReadme, updateReadmeTitle } from "./readme.js";

async function resolveWorkTitle(workPath: string): Promise<string> {
  const readme = await readReadme(workPath);
  if (readme?.title) return readme.title;

  const meta = await readWorkUserMeta(workPath);
  if (meta.displayTitle) return meta.displayTitle;

  return basename(workPath) || "未命名作品";
}

export async function loadWork(workPath: string): Promise<WorkSnapshot> {
  const title = await resolveWorkTitle(workPath);
  const meta = await readWorkUserMeta(workPath);
  return {
    workPath,
    manifest: { title },
    revision: meta.revision ?? 0,
  };
}

export async function updateWorkTitle(
  workPath: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;

  const updatedReadme = await updateReadmeTitle(workPath, trimmed);
  if (!updatedReadme) {
    await setWorkDisplayTitle(workPath, trimmed);
  }
}

export async function initWorkspaceAtPath(
  workPath: string,
  title?: string,
): Promise<string> {
  await mkdir(workPath, { recursive: true });
  await prepareConversationStore(workPath);
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
