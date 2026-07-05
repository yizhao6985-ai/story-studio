import type { AgentMode } from "../../../../src/lib/story/types.js";
import type { WorkLoopState } from "./types.js";
import { resolveToolName } from "#agent/shared/tooling.js";
import { TOOL_NAMES, toolsForMode } from "./tool-names.js";

export {
  ALL_KNOWN_TOOLS,
  isKnownTool,
  TOOL_NAMES,
  toolsForMode,
  type ToolName,
} from "./tool-names.js";

type GateResult =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

export function validateToolCall(
  toolName: string,
  args: Record<string, unknown>,
  workLoop: WorkLoopState,
  mode: AgentMode,
): GateResult {
  const resolved = resolveToolName(toolName);
  if (resolved.kind === "rejected") {
    return {
      allowed: false,
      code: resolved.code,
      message: resolved.hint
        ? `${resolved.message}。${resolved.hint}`
        : resolved.message,
    };
  }

  toolName = resolved.name;

  const allowedNames = toolsForMode(mode);
  if (!allowedNames.includes(toolName)) {
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

  if (toolName === TOOL_NAMES.delete) {
    if (!path) {
      return { allowed: false, code: "MISSING_PATH", message: "缺少 path" };
    }

    const pinned = workLoop.pinnedTargets.find(
      (p) => p.path === path && p.action === "delete",
    );
    if (!pinned) {
      return {
        allowed: false,
        code: "NOT_PINNED",
        message: `删除前须先 pin_write_target 定位 ${path}（action=delete）`,
      };
    }

    if (!workLoop.readCache[path] && !workLoop.visitedPaths.includes(path)) {
      return {
        allowed: false,
        code: "NOT_READ_YET",
        message: `删除前须先 read_workspace_file 或 explore 确认 ${path}`,
      };
    }
  }

  if (toolName === TOOL_NAMES.rename) {
    const fromPath =
      typeof args.fromPath === "string" ? args.fromPath : undefined;
    const toPath = typeof args.toPath === "string" ? args.toPath : undefined;
    if (!fromPath || !toPath) {
      return {
        allowed: false,
        code: "MISSING_PATH",
        message: "缺少 fromPath 或 toPath",
      };
    }

    const pinned = workLoop.pinnedTargets.find(
      (p) => p.path === fromPath && p.action === "rename",
    );
    if (!pinned) {
      return {
        allowed: false,
        code: "NOT_PINNED",
        message: `重命名前须先 pin_write_target 定位 ${fromPath}（action=rename）`,
      };
    }

    if (
      !workLoop.readCache[fromPath] &&
      !workLoop.visitedPaths.includes(fromPath)
    ) {
      return {
        allowed: false,
        code: "NOT_READ_YET",
        message: `重命名前须先 read_workspace_file 或 explore 确认 ${fromPath}`,
      };
    }
  }

  return { allowed: true };
}
