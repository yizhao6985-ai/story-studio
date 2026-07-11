import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  createWorkWorkspaceDirectory,
  createWorkWorkspaceFile,
  deleteWorkWorkspaceEntry,
  listWorkFileTree,
  readWorkWorkspaceFile,
  writeWorkWorkspaceFile,
} from "@story-studio/workspace-fs";
import {
  isTextFile,
  normalizeWorkspaceRelativePath,
} from "@story-studio/workspace-fs/paths";

import { assertRequestWorkPath } from "./request-context.js";

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

  return files;
}

function formatTree(
  nodes: Awaited<ReturnType<typeof listWorkFileTree>>,
  indent = 0,
): string {
  const lines: string[] = [];
  for (const node of nodes) {
    const prefix = "  ".repeat(indent);
    lines.push(`${prefix}${node.kind === "directory" ? "📁" : "📄"} ${node.path}`);
    if (node.children?.length) {
      lines.push(formatTree(node.children, indent + 1));
    }
  }
  return lines.join("\n");
}

export async function handleListFiles(pattern?: string): Promise<string> {
  const workPath = assertRequestWorkPath();
  const tree = await listWorkFileTree(workPath);
  const text = formatTree(tree);
  if (!pattern?.trim()) return text;
  const regex = new RegExp(
    pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"),
    "i",
  );
  return text
    .split("\n")
    .filter((line) => regex.test(line))
    .join("\n");
}

export async function handleGrep(
  query: string,
  pathPattern?: string,
): Promise<string> {
  const workPath = assertRequestWorkPath();
  const files = await walkTextFiles(workPath);
  const matches: string[] = [];
  const pathRegex = pathPattern
    ? new RegExp(
        pathPattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"),
        "i",
      )
    : null;

  for (const file of files) {
    if (pathRegex && !pathRegex.test(file)) continue;
    const result = await readWorkWorkspaceFile(workPath, file);
    if (!result.readable) continue;
    const lines = result.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes(query)) {
        matches.push(`${file}:${i + 1}: ${lines[i]!.trim().slice(0, 200)}`);
      }
    }
    if (matches.length >= 50) break;
  }

  return matches.length > 0 ? matches.slice(0, 50).join("\n") : "（无匹配）";
}

export async function handleReadFile(input: {
  path: string;
  startLine?: number;
  endLine?: number;
}): Promise<string> {
  const workPath = assertRequestWorkPath();
  const result = await readWorkWorkspaceFile(workPath, input.path, {
    startLine: input.startLine,
    endLine: input.endLine,
  });
  if (!result.readable) {
    return `无法读取：${input.path}（非文本文件）`;
  }
  return [
    `path: ${result.path}`,
    `lines: ${result.startLine}-${result.endLine} / ${result.totalLines}`,
    result.hasMore ? "（有更多内容，可用 startLine/endLine 分页）" : "",
    "---",
    result.content,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function handleFileStat(path: string): Promise<string> {
  const workPath = assertRequestWorkPath();
  const relativePath = normalizeWorkspaceRelativePath(workPath, path);
  const absPath = join(workPath, relativePath);
  const info = await stat(absPath);
  return JSON.stringify({
    path: relativePath,
    kind: info.isDirectory() ? "directory" : "file",
    size: info.size,
    modifiedAt: info.mtime.toISOString(),
  });
}

export async function handleEditFile(input: {
  path: string;
  old_string: string;
  new_string: string;
}): Promise<string> {
  const workPath = assertRequestWorkPath();
  const relativePath = normalizeWorkspaceRelativePath(workPath, input.path);
  const absPath = join(workPath, relativePath);
  const raw = await readFile(absPath, "utf8");
  if (!raw.includes(input.old_string)) {
    throw new Error("EDIT_STRING_NOT_FOUND");
  }
  const updated = raw.replace(input.old_string, input.new_string);
  await writeWorkWorkspaceFile(workPath, relativePath, updated);
  return `已编辑 ${relativePath}`;
}

export async function handleWriteFile(input: {
  path: string;
  content: string;
}): Promise<string> {
  const workPath = assertRequestWorkPath();
  const relativePath = normalizeWorkspaceRelativePath(workPath, input.path);
  try {
    await createWorkWorkspaceFile(workPath, relativePath, input.content);
    return `已创建 ${relativePath}`;
  } catch {
    await writeWorkWorkspaceFile(workPath, relativePath, input.content);
    return `已写入 ${relativePath}`;
  }
}

export async function handleMkdir(path: string): Promise<string> {
  const workPath = assertRequestWorkPath();
  const relativePath = normalizeWorkspaceRelativePath(workPath, path);
  await createWorkWorkspaceDirectory(workPath, relativePath);
  return `已创建目录 ${relativePath}`;
}

export async function handleDeleteFile(path: string): Promise<string> {
  const workPath = assertRequestWorkPath();
  const relativePath = normalizeWorkspaceRelativePath(workPath, path);
  await deleteWorkWorkspaceEntry(workPath, relativePath);
  return `已删除 ${relativePath}`;
}
