import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { WorkspaceEntry } from "@story-studio/shared/story";

import { isTextFile } from "./paths.ts";

const HIDDEN_ENTRIES = new Set([".git", ".DS_Store"]);

async function walkWorkspace(
  dir: string,
  relativeBase: string,
): Promise<WorkspaceEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nodes: WorkspaceEntry[] = [];

  for (const entry of entries) {
    if (HIDDEN_ENTRIES.has(entry.name)) continue;

    const absPath = join(dir, entry.name);
    const relPath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      nodes.push({
        path: relPath,
        name: entry.name,
        kind: "directory",
        children: await walkWorkspace(absPath, relPath),
      });
      continue;
    }

    nodes.push({
      path: relPath,
      name: entry.name,
      kind: "file",
    });
  }

  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

export async function listWorkFileTree(
  workPath: string,
): Promise<WorkspaceEntry[]> {
  return walkWorkspace(workPath, "");
}

async function walkTextFiles(workPath: string, dir = ""): Promise<string[]> {
  const absDir = dir ? join(workPath, dir) : workPath;
  const entries = await readdir(absDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walkTextFiles(workPath, rel)));
      continue;
    }
    if (isTextFile(entry.name)) {
      files.push(rel);
    }
  }

  return files.sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export async function listWorkTextFilePaths(workPath: string): Promise<string[]> {
  return walkTextFiles(workPath);
}
