import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import { initGitRepo } from "./git.js";
import { isProtectedWorkspacePath } from "./protected-paths.js";
import {
  assertParentDirectorySegments,
  assertWorkspaceDirectorySegments,
  assertWorkspaceEntryName,
  isTextFile,
  resolveWorkspaceFilePath,
} from "./paths.js";
import { bumpWorkManifest } from "./work-meta.js";

async function ensureGitOnFirstWrite(workPath: string): Promise<void> {
  try {
    await stat(join(workPath, ".git"));
  } catch {
    await initGitRepo(workPath);
  }
}

function assertNotProtected(
  relativePath: string,
  operation: "delete" | "rename",
): void {
  if (!isProtectedWorkspacePath(relativePath)) return;
  throw new Error(
    operation === "delete" ? "PROTECTED_FILE" : "PROTECTED_RENAME",
  );
}

const DEFAULT_READ_MAX_LINES = 200;

export function hashWorkspaceContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export async function workspaceFileExists(
  workPath: string,
  relativePath: string,
): Promise<boolean> {
  try {
    await stat(resolveWorkspaceFilePath(workPath, relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function readWorkWorkspaceFile(
  workPath: string,
  relativePath: string,
  options?: { startLine?: number; endLine?: number },
): Promise<{
  path: string;
  content: string;
  readable: boolean;
  startLine: number;
  endLine: number;
  totalLines: number;
  hasMore: boolean;
}> {
  const absPath = resolveWorkspaceFilePath(workPath, relativePath);
  const name = relativePath.split("/").pop() ?? relativePath;

  if (!isTextFile(name)) {
    return {
      path: relativePath,
      content: "",
      readable: false,
      startLine: 0,
      endLine: 0,
      totalLines: 0,
      hasMore: false,
    };
  }

  const raw = await readFile(absPath, "utf8");
  const lines = raw.split(/\r\n|\r|\n/);
  const totalLines = lines.length;

  const start = Math.max(1, options?.startLine ?? 1);
  const end = Math.min(
    totalLines,
    options?.endLine ?? Math.min(totalLines, start + DEFAULT_READ_MAX_LINES - 1),
  );

  const slice = lines.slice(start - 1, end);
  const hasMore = end < totalLines || start > 1;

  return {
    path: relativePath,
    content: slice.join("\n"),
    readable: true,
    startLine: totalLines === 0 ? 0 : start,
    endLine: totalLines === 0 ? 0 : end,
    totalLines,
    hasMore,
  };
}

export async function patchWorkWorkspaceFile(
  workPath: string,
  relativePath: string,
  oldText: string,
  newText: string,
): Promise<{ replaced: boolean; occurrences: number }> {
  const absPath = resolveWorkspaceFilePath(workPath, relativePath);
  const name = relativePath.split("/").pop() ?? relativePath;
  if (!isTextFile(name)) throw new Error("FILE_NOT_WRITABLE");

  const fullContent = await readFile(absPath, "utf8");
  const occurrences = fullContent.split(oldText).length - 1;
  if (occurrences === 0) {
    return { replaced: false, occurrences: 0 };
  }

  const updated = fullContent.replace(oldText, newText);
  await writeFile(absPath, updated, "utf8");
  await ensureGitOnFirstWrite(workPath);
  await bumpWorkManifest(workPath);

  return { replaced: true, occurrences };
}

export async function writeWorkWorkspaceFile(
  workPath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const absPath = resolveWorkspaceFilePath(workPath, relativePath);
  const name = relativePath.split("/").pop() ?? relativePath;

  if (!isTextFile(name)) {
    throw new Error("FILE_NOT_WRITABLE");
  }

  assertParentDirectorySegments(relativePath);
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, content, "utf8");
  await ensureGitOnFirstWrite(workPath);
  await bumpWorkManifest(workPath);
}

export async function createWorkWorkspaceFile(
  workPath: string,
  relativePath: string,
  content = "",
): Promise<void> {
  const name = relativePath.split("/").pop() ?? relativePath;
  assertWorkspaceEntryName(name);

  if (!isTextFile(name)) {
    throw new Error("FILE_NOT_WRITABLE");
  }

  const absPath = resolveWorkspaceFilePath(workPath, relativePath);
  assertParentDirectorySegments(relativePath);
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, content, { encoding: "utf8", flag: "wx" });
  await ensureGitOnFirstWrite(workPath);
  await bumpWorkManifest(workPath);
}

export async function createWorkWorkspaceDirectory(
  workPath: string,
  relativePath: string,
): Promise<void> {
  assertWorkspaceDirectorySegments(relativePath);

  const absPath = resolveWorkspaceFilePath(workPath, relativePath);
  await mkdir(absPath, { recursive: false });
  await bumpWorkManifest(workPath);
}

export async function deleteWorkWorkspaceEntry(
  workPath: string,
  relativePath: string,
): Promise<void> {
  assertNotProtected(relativePath, "delete");
  const absPath = resolveWorkspaceFilePath(workPath, relativePath);
  await rm(absPath, { recursive: true, force: false });
  await bumpWorkManifest(workPath);
}

export async function renameWorkWorkspaceEntry(
  workPath: string,
  fromPath: string,
  toPath: string,
): Promise<void> {
  assertNotProtected(fromPath, "rename");
  const nextName = toPath.split("/").pop() ?? toPath;
  assertWorkspaceEntryName(nextName);
  assertParentDirectorySegments(toPath);

  const fromAbs = resolveWorkspaceFilePath(workPath, fromPath);
  const toAbs = resolveWorkspaceFilePath(workPath, toPath);
  const entryStat = await stat(fromAbs);

  if (entryStat.isFile() && !isTextFile(nextName)) {
    throw new Error("FILE_NOT_WRITABLE");
  }

  await mkdir(dirname(toAbs), { recursive: true });
  await rename(fromAbs, toAbs);
  await bumpWorkManifest(workPath);
}
