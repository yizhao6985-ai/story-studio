import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import { initGitRepo } from "./git.ts";
import { isProtectedWorkspacePath } from "./protected-paths.ts";
import {
  assertParentDirectorySegments,
  assertWorkspaceDirectorySegments,
  assertWorkspaceEntryName,
  isTextFile,
  normalizeWorkspaceRelativePath,
  resolveWorkspaceFilePath,
} from "./paths.ts";
import { bumpWorkManifest } from "./work-meta.ts";

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

export async function readWorkWorkspaceFile(
  workPath: string,
  inputPath: string,
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
  const relativePath = normalizeWorkspaceRelativePath(workPath, inputPath);
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

export async function writeWorkWorkspaceFile(
  workPath: string,
  inputPath: string,
  content: string,
): Promise<void> {
  const relativePath = normalizeWorkspaceRelativePath(workPath, inputPath);
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
  inputPath: string,
  content = "",
): Promise<void> {
  const relativePath = normalizeWorkspaceRelativePath(workPath, inputPath);
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
  inputPath: string,
): Promise<void> {
  const relativePath = normalizeWorkspaceRelativePath(workPath, inputPath);
  assertWorkspaceDirectorySegments(relativePath);

  const absPath = resolveWorkspaceFilePath(workPath, relativePath);
  await mkdir(absPath, { recursive: false });
  await bumpWorkManifest(workPath);
}

export async function deleteWorkWorkspaceEntry(
  workPath: string,
  inputPath: string,
): Promise<void> {
  const relativePath = normalizeWorkspaceRelativePath(workPath, inputPath);
  assertNotProtected(relativePath, "delete");
  const absPath = resolveWorkspaceFilePath(workPath, relativePath);
  await rm(absPath, { recursive: true, force: false });
  await bumpWorkManifest(workPath);
}

export async function renameWorkWorkspaceEntry(
  workPath: string,
  fromInputPath: string,
  toInputPath: string,
): Promise<void> {
  const fromPath = normalizeWorkspaceRelativePath(workPath, fromInputPath);
  const toPath = normalizeWorkspaceRelativePath(workPath, toInputPath);
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
