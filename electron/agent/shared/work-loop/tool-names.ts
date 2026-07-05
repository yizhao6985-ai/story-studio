import type { AgentMode } from "../../../../src/lib/story/types.js";

export const TOOL_NAMES = {
  explore: "explore_workspace",
  glob: "glob_workspace",
  grep: "grep_workspace",
  read: "read_workspace_file",
  pin: "pin_write_target",
  patch: "patch_workspace_file",
  write: "write_workspace_file",
  create: "create_workspace_file",
  delete: "delete_workspace_file",
  rename: "rename_workspace_entry",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

const READ_TOOLS: ToolName[] = [
  TOOL_NAMES.explore,
  TOOL_NAMES.glob,
  TOOL_NAMES.grep,
  TOOL_NAMES.read,
];

const WRITE_TOOLS: ToolName[] = [
  TOOL_NAMES.pin,
  TOOL_NAMES.patch,
  TOOL_NAMES.write,
  TOOL_NAMES.create,
  TOOL_NAMES.delete,
  TOOL_NAMES.rename,
];

export const ALL_KNOWN_TOOLS: ToolName[] = [...READ_TOOLS, ...WRITE_TOOLS];

export function isKnownTool(toolName: string): toolName is ToolName {
  return ALL_KNOWN_TOOLS.includes(toolName as ToolName);
}

export function toolsForMode(mode: AgentMode): ToolName[] {
  if (mode === "normal") {
    return [...READ_TOOLS, ...WRITE_TOOLS];
  }
  return READ_TOOLS;
}
