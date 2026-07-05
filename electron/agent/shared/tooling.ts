import { TOOL_NAMES, type ToolName } from "#agent/shared/work-loop/tool-names.js";

const IDE_TOOL_PATTERN =
  /^(todowrite|todo_write|task|switchmode|switch_mode|askquestion)$/i;

const TOOL_ALIASES: Record<string, ToolName> = {
  explore: TOOL_NAMES.explore,
  glob: TOOL_NAMES.glob,
  grep: TOOL_NAMES.grep,
  read: TOOL_NAMES.read,
  patch: TOOL_NAMES.patch,
  write: TOOL_NAMES.write,
  create: TOOL_NAMES.create,
  delete: TOOL_NAMES.delete,
  rename: TOOL_NAMES.rename,
  pin: TOOL_NAMES.pin,
};

export type ToolResolveResult =
  | { kind: "resolved"; name: ToolName; original: string }
  | { kind: "rejected"; code: string; message: string; hint: string };

function normalizeToolKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function resolveToolName(raw: string): ToolResolveResult {
  const trimmed = raw.trim();
  const key = normalizeToolKey(trimmed);

  if (IDE_TOOL_PATTERN.test(key) || key.includes("todo")) {
    return {
      kind: "rejected",
      code: "IDE_TOOL",
      message: `不支持工具 ${trimmed}`,
      hint: "请调用 explore_workspace、glob_workspace、grep_workspace、read_workspace_file 等作品库工具。",
    };
  }

  if (Object.values(TOOL_NAMES).includes(trimmed as ToolName)) {
    return { kind: "resolved", name: trimmed as ToolName, original: trimmed };
  }

  const alias = TOOL_ALIASES[key];
  if (alias) {
    return { kind: "resolved", name: alias, original: trimmed };
  }

  return {
    kind: "rejected",
    code: "UNKNOWN_TOOL",
    message: `未知工具 ${trimmed}`,
    hint: "请调用 explore_workspace、glob_workspace、grep_workspace、read_workspace_file 等作品库工具。",
  };
}
