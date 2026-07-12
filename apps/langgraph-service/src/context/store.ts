import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { workUserDataDir } from "@story-studio/shared/paths";
import { getUserDataRoot } from "@story-studio/workspace-fs";

import type { WorkContext } from "./types.js";

const CONTEXT_FILE = "context.json";
const memoryCache = new Map<string, WorkContext>();

function contextPathFor(workPath: string): string {
  return join(workUserDataDir(getUserDataRoot(), workPath), CONTEXT_FILE);
}

export async function loadWorkContext(
  workPath: string,
): Promise<WorkContext | null> {
  const cached = memoryCache.get(workPath);
  if (cached) return cached;

  try {
    const raw = await readFile(contextPathFor(workPath), "utf8");
    const parsed = JSON.parse(raw) as WorkContext;
    if (parsed.workPath !== workPath || !Array.isArray(parsed.files)) {
      return null;
    }
    memoryCache.set(workPath, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function saveWorkContext(context: WorkContext): Promise<void> {
  const path = contextPathFor(context.workPath);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(context, null, 2), "utf8");
  memoryCache.set(context.workPath, context);
}

export function clearWorkContextCache(workPath: string): void {
  memoryCache.delete(workPath);
}
