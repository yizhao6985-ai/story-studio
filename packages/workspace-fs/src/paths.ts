import { resolve } from "node:path";

export const TEXT_EXTENSIONS = new Set([
  ".md",
  ".yaml",
  ".yml",
  ".json",
  ".txt",
  ".csv",
]);

export function isTextFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

export function resolveWorkspaceFilePath(
  workPath: string,
  relativePath: string,
): string {
  const segments = relativePath.replace(/^\/+/, "").split("/").filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((part) => part === ".." || part === ".")
  ) {
    throw new Error("INVALID_WORKSPACE_PATH");
  }

  const absPath = resolve(workPath, ...segments);
  const root = resolve(workPath);
  if (absPath !== root && !absPath.startsWith(`${root}/`)) {
    throw new Error("INVALID_WORKSPACE_PATH");
  }

  return absPath;
}

export function assertWorkspaceEntryName(name: string): void {
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error("INVALID_ENTRY_NAME");
  }
}

const NON_ASCII = /[^\x00-\x7F]/;

/** 目录名须为 ASCII（建议小写英文 + 连字符/下划线）。 */
export function assertWorkspaceDirectoryName(name: string): void {
  assertWorkspaceEntryName(name);
  if (NON_ASCII.test(name)) {
    throw new Error("DIRECTORY_NAME_NOT_ASCII");
  }
}

export function assertWorkspaceDirectorySegments(relativePath: string): void {
  const segments = relativePath.replace(/^\/+/, "").split("/").filter(Boolean);
  for (const segment of segments) {
    assertWorkspaceDirectoryName(segment);
  }
}

export function assertParentDirectorySegments(relativePath: string): void {
  const segments = relativePath.replace(/^\/+/, "").split("/").filter(Boolean);
  for (const segment of segments.slice(0, -1)) {
    assertWorkspaceDirectoryName(segment);
  }
}
