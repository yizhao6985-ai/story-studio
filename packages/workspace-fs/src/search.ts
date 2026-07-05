import { readdir, readFile, stat } from "node:fs/promises";

import { isTextFile, resolveWorkspaceFilePath } from "./paths.js";

const HIDDEN_ENTRIES = new Set([".git", ".DS_Store"]);
const MAX_GLOB_RESULTS = 50;
const MAX_GREP_MATCHES = 30;
const GREP_CONTEXT_LINES = 1;

export type GrepMatch = {
  path: string;
  line: number;
  text: string;
  contextBefore?: string[];
  contextAfter?: string[];
};

async function collectTextFiles(
  workPath: string,
  relativeDir: string,
): Promise<string[]> {
  const absDir = relativeDir
    ? resolveWorkspaceFilePath(workPath, relativeDir)
    : workPath;

  let dirStat;
  try {
    dirStat = await stat(absDir);
  } catch {
    return [];
  }
  if (!dirStat.isDirectory()) return [];

  const files: string[] = [];
  const entries = await readdir(absDir, { withFileTypes: true });

  for (const entry of entries) {
    if (HIDDEN_ENTRIES.has(entry.name)) continue;

    const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(workPath, relPath)));
      continue;
    }

    if (isTextFile(entry.name)) files.push(relPath);
  }

  return files;
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

export async function globWorkWorkspace(
  workPath: string,
  pattern: string,
): Promise<{ paths: string[]; truncated: boolean }> {
  const allFiles = await collectTextFiles(workPath, "");
  const matcher = globToRegExp(pattern);
  const matched = allFiles.filter((path) => matcher.test(path)).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );

  if (matched.length <= MAX_GLOB_RESULTS) {
    return { paths: matched, truncated: false };
  }

  return {
    paths: matched.slice(0, MAX_GLOB_RESULTS),
    truncated: true,
  };
}

export async function grepWorkWorkspace(input: {
  workPath: string;
  query: string;
  pathPrefix?: string;
  useRegex?: boolean;
}): Promise<{ matches: GrepMatch[]; truncated: boolean; filesScanned: number }> {
  const { workPath, query, pathPrefix = "", useRegex = false } = input;
  const files = await collectTextFiles(workPath, pathPrefix);
  const matcher = useRegex ? new RegExp(query, "i") : null;
  const needle = query.toLowerCase();

  const matches: GrepMatch[] = [];

  for (const relPath of files) {
    if (matches.length >= MAX_GREP_MATCHES) break;

    const absPath = resolveWorkspaceFilePath(workPath, relPath);
    let content: string;
    try {
      content = await readFile(absPath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split(/\r\n|\r|\n/);
    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= MAX_GREP_MATCHES) break;

      const line = lines[i]!;
      const hit = matcher
        ? matcher.test(line)
        : line.toLowerCase().includes(needle);
      if (!hit) continue;

      const contextBefore = lines
        .slice(Math.max(0, i - GREP_CONTEXT_LINES), i)
        .filter(Boolean);
      const contextAfter = lines
        .slice(i + 1, i + 1 + GREP_CONTEXT_LINES)
        .filter(Boolean);

      matches.push({
        path: relPath,
        line: i + 1,
        text: line.trim(),
        contextBefore: contextBefore.length ? contextBefore : undefined,
        contextAfter: contextAfter.length ? contextAfter : undefined,
      });
    }
  }

  return {
    matches,
    truncated: matches.length >= MAX_GREP_MATCHES,
    filesScanned: files.length,
  };
}
