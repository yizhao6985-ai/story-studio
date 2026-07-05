import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import { isTextFile, resolveWorkspaceFilePath } from "./paths.js";

const HIDDEN_ENTRIES = new Set([".git", ".DS_Store"]);

export type ExploreEntry = {
  path: string;
  name: string;
  kind: "file" | "directory";
  size?: number;
};

export async function exploreWorkWorkspace(
  workPath: string,
  relativePath = "",
): Promise<ExploreEntry[]> {
  const absPath = relativePath
    ? resolveWorkspaceFilePath(workPath, relativePath)
    : resolve(workPath);

  const dirStat = await stat(absPath);
  if (!dirStat.isDirectory()) {
    throw new Error("NOT_A_DIRECTORY");
  }

  const entries = await readdir(absPath, { withFileTypes: true });
  const result: ExploreEntry[] = [];

  for (const entry of entries) {
    if (HIDDEN_ENTRIES.has(entry.name)) continue;

    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      result.push({ path: relPath, name: entry.name, kind: "directory" });
      continue;
    }

    const name = entry.name;
    if (!isTextFile(name)) continue;

    const fileStat = await stat(join(absPath, entry.name));
    result.push({
      path: relPath,
      name,
      kind: "file",
      size: fileStat.size,
    });
  }

  return result.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}
