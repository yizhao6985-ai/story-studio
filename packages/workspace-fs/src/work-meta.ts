import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { workUserDataDir } from "@story-studio/shared/paths";

import { getUserDataRoot } from "./config.ts";

export interface WorkUserMeta {
  displayTitle?: string;
  revision?: number;
}

function metaPath(workPath: string): string {
  return join(workUserDataDir(getUserDataRoot(), workPath), "meta.json");
}

export async function readWorkUserMeta(
  workPath: string,
): Promise<WorkUserMeta> {
  try {
    const raw = await readFile(metaPath(workPath), "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkUserMeta>;
    return {
      displayTitle:
        typeof parsed.displayTitle === "string"
          ? parsed.displayTitle
          : undefined,
      revision: typeof parsed.revision === "number" ? parsed.revision : 0,
    };
  } catch {
    return { revision: 0 };
  }
}

async function writeWorkUserMeta(
  workPath: string,
  patch: Partial<WorkUserMeta>,
): Promise<WorkUserMeta> {
  const dir = workUserDataDir(getUserDataRoot(), workPath);
  await mkdir(dir, { recursive: true });
  const current = await readWorkUserMeta(workPath);
  const next: WorkUserMeta = { ...current, ...patch };
  await writeFile(metaPath(workPath), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function setWorkDisplayTitle(
  workPath: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  await writeWorkUserMeta(workPath, { displayTitle: trimmed });
}

export async function bumpWorkRevision(workPath: string): Promise<number> {
  const current = await readWorkUserMeta(workPath);
  const revision = (current.revision ?? 0) + 1;
  await writeWorkUserMeta(workPath, { revision });
  return revision;
}

export async function bumpWorkManifest(workPath: string): Promise<void> {
  await bumpWorkRevision(workPath);
}
