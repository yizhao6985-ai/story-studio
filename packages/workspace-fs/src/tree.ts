import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { WorkspaceEntry } from "@story-studio/shared/story";

import { README_FILE } from "./constants.js";

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

export function pickDefaultWorkspaceFile(
  entries: WorkspaceEntry[],
): string | null {
  if (findWorkspaceFile(entries, README_FILE)) return README_FILE;

  const firstFile = findWorkspaceFile(
    entries,
    (entry) => entry.kind === "file" && entry.name.endsWith(".md"),
  );
  return firstFile?.path ?? null;
}

function findWorkspaceFile(
  entries: WorkspaceEntry[],
  matcher: string | ((entry: WorkspaceEntry) => boolean),
): WorkspaceEntry | null {
  for (const entry of entries) {
    const matched =
      typeof matcher === "string"
        ? entry.kind === "file" && entry.path === matcher
        : matcher(entry);

    if (matched) return entry;

    if (entry.children?.length) {
      const nested = findWorkspaceFile(entry.children, matcher);
      if (nested) return nested;
    }
  }
  return null;
}
