import { isAbsolute, relative, resolve } from "node:path";

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

function assertRelativeWorkspaceSegments(relativePath: string): string {
  const segments = relativePath.split("/").filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((part) => part === ".." || part === ".")
  ) {
    throw new Error("INVALID_WORKSPACE_PATH");
  }

  return segments.join("/");
}

/** 将工具入参（相对或误传的绝对路径）规范为作品库内相对路径。 */
export function normalizeWorkspaceRelativePath(
  workPath: string,
  inputPath: string,
): string {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new Error("INVALID_WORKSPACE_PATH");
  }

  const root = resolve(workPath);

  const fromAbsolute = (absPath: string): string => {
    const resolved = resolve(absPath);
    if (resolved === root || !resolved.startsWith(`${root}/`)) {
      throw new Error("INVALID_WORKSPACE_PATH");
    }
    return assertRelativeWorkspaceSegments(relative(root, resolved));
  };

  if (isAbsolute(trimmed)) {
    return fromAbsolute(trimmed);
  }

  if (trimmed.startsWith(root)) {
    return assertRelativeWorkspaceSegments(
      trimmed.slice(root.length).replace(/^[/\\]+/, ""),
    );
  }

  // POSIX 上 agent 可能传入缺少前导 / 的绝对路径，如 Users/yi/Projects/...
  if (process.platform !== "win32") {
    const posixAbs = resolve(`/${trimmed.replace(/^\/+/, "")}`);
    if (posixAbs.startsWith(`${root}/`)) {
      return fromAbsolute(posixAbs);
    }
  }

  return assertRelativeWorkspaceSegments(trimmed.replace(/^[/\\]+/, ""));
}

export function resolveWorkspaceFilePath(
  workPath: string,
  inputPath: string,
): string {
  const relativePath = normalizeWorkspaceRelativePath(workPath, inputPath);
  const root = resolve(workPath);
  const absPath = resolve(root, relativePath);

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
