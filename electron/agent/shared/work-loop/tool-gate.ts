import type { AgentMode } from "../../../../src/lib/story/types.js";
import type { WorkLoopState } from "./types.js";

export const TOOL_NAMES = {
  explore: "explore_workspace",
  glob: "glob_workspace",
  grep: "grep_workspace",
  read: "read_workspace_file",
  pin: "pin_write_target",
  patch: "patch_workspace_file",
  write: "write_workspace_file",
  create: "create_workspace_file",
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
];

export function toolsForMode(mode: AgentMode): ToolName[] {
  if (mode === "normal") {
    return [...READ_TOOLS, ...WRITE_TOOLS];
  }
  return READ_TOOLS;
}

type GateResult =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

export function validateToolCall(
  toolName: string,
  args: Record<string, unknown>,
  workLoop: WorkLoopState,
  mode: AgentMode,
): GateResult {
  const allowedNames = toolsForMode(mode);
  if (!allowedNames.includes(toolName as ToolName)) {
    return {
      allowed: false,
      code: "MODE_BLOCKED",
      message: `当前模式不可用工具 ${toolName}`,
    };
  }

  if (mode !== "normal") return { allowed: true };

  const path = typeof args.path === "string" ? args.path : undefined;

  if (toolName === TOOL_NAMES.write || toolName === TOOL_NAMES.patch) {
    if (!path) {
      return { allowed: false, code: "MISSING_PATH", message: "缺少 path" };
    }

    const pinned = workLoop.pinnedTargets.find(
      (p) => p.path === path && p.action !== "create",
    );
    if (!pinned) {
      return {
        allowed: false,
        code: "NOT_PINNED",
        message: `写入前须先 pin_write_target 定位 ${path}`,
      };
    }

    if (!workLoop.readCache[path]) {
      return {
        allowed: false,
        code: "NOT_READ_YET",
        message: `覆盖/补丁前须先 read_workspace_file ${path}`,
      };
    }
  }

  if (toolName === TOOL_NAMES.create) {
    if (!path) {
      return { allowed: false, code: "MISSING_PATH", message: "缺少 path" };
    }

    const pinned = workLoop.pinnedTargets.find(
      (p) => p.path === path && p.action === "create",
    );
    if (!pinned) {
      return {
        allowed: false,
        code: "NOT_PINNED",
        message: `新建前须先 pin_write_target 定位 ${path}`,
      };
    }
  }

  return { allowed: true };
}
