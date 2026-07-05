import { readFile } from "node:fs/promises";

import {
  hashWorkspaceContent,
} from "../../../library/index.js";
import { isTextFile, resolveWorkspaceFilePath } from "../../../library/workspace/paths.js";

import {
  activityFromToolResult,
  appendActivity,
  buildActivityLabel,
} from "#agent/shared/work-loop/activity-log.js";
import { TOOL_NAMES } from "#agent/shared/work-loop/tool-gate.js";
import { completeCurrentSubtaskAfterVerify } from "../advance-subtask/subtasks.js";
import type { PinnedTarget, WriteAction, WorkLoopState } from "#agent/shared/work-loop/types.js";
import type { AgentMode } from "../../../../src/lib/story/types.js";

function parseToolJson(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type PostToolUpdate = {
  workLoop: WorkLoopState;
  verifyMessages: Array<{ tool: string; content: string; args?: Record<string, unknown> }>;
};

export async function applyPostToolUpdates(
  workPath: string,
  workLoop: WorkLoopState,
  mode: AgentMode,
  toolResults: Array<{ name: string; content: string; args: Record<string, unknown> }>,
): Promise<PostToolUpdate> {
  let loop: WorkLoopState = {
    ...workLoop,
    stepCount: workLoop.stepCount + 1,
    visitedPaths: [...workLoop.visitedPaths],
    readCache: { ...workLoop.readCache },
    pinnedTargets: [...workLoop.pinnedTargets],
    activityLog: [...workLoop.activityLog],
  };

  const verifyMessages: PostToolUpdate["verifyMessages"] = [];
  let wroteThisBatch = false;
  let lastWrittenPath: string | undefined;

  for (const result of toolResults) {
    loop = activityFromToolResult({
      workLoop: loop,
      toolName: result.name,
      args: result.args,
      content: result.content,
    });

    const parsed = parseToolJson(result.content);
    const ok = parsed?.ok === true;

    switch (result.name) {
      case TOOL_NAMES.read: {
        if (ok && parsed?.data && typeof parsed.data === "object") {
          const data = parsed.data as {
            path?: string;
            content?: string;
            readable?: boolean;
          };
          if (data.path && data.readable && typeof data.content === "string") {
            if (!loop.visitedPaths.includes(data.path)) {
              loop.visitedPaths.push(data.path);
            }
            const prev = loop.readCache[data.path];
            loop.readCache[data.path] = {
              hash: hashWorkspaceContent(data.content),
              excerpt: data.content.slice(0, 400),
              readCount: (prev?.readCount ?? 0) + 1,
            };
          }
        }
        break;
      }

      case TOOL_NAMES.pin: {
        if (ok && parsed?.data && typeof parsed.data === "object") {
          const data = parsed.data as {
            path?: string;
            action?: WriteAction;
            reason?: string;
          };
          if (data.path && data.action) {
            const pin: PinnedTarget = {
              path: data.path,
              action: data.action,
              reason: data.reason,
              readHash: loop.readCache[data.path]?.hash,
            };
            loop.pinnedTargets = [
              ...loop.pinnedTargets.filter((p) => p.path !== data.path),
              pin,
            ];
          }
        }
        break;
      }

      case TOOL_NAMES.patch:
      case TOOL_NAMES.write:
      case TOOL_NAMES.create: {
        if (ok && parsed?.data && typeof parsed.data === "object") {
          const data = parsed.data as { path?: string };
          if (data.path) {
            wroteThisBatch = true;
            lastWrittenPath = data.path;
            loop.lastWrittenPath = data.path;
          }
        }
        break;
      }

      case TOOL_NAMES.delete: {
        if (ok && parsed?.data && typeof parsed.data === "object") {
          const data = parsed.data as { path?: string };
          if (data.path) {
            delete loop.readCache[data.path];
            loop.visitedPaths = loop.visitedPaths.filter((p) => p !== data.path);
            loop.pinnedTargets = loop.pinnedTargets.filter(
              (p) => p.path !== data.path,
            );
            loop = completeCurrentSubtaskAfterVerify(loop, data.path);
          }
        }
        break;
      }

      case TOOL_NAMES.rename: {
        if (ok && parsed?.data && typeof parsed.data === "object") {
          const data = parsed.data as { fromPath?: string; toPath?: string };
          if (data.fromPath && data.toPath) {
            const cached = loop.readCache[data.fromPath];
            if (cached) {
              loop.readCache[data.toPath] = cached;
              delete loop.readCache[data.fromPath];
            }
            loop.visitedPaths = [
              ...loop.visitedPaths.filter((p) => p !== data.fromPath),
              data.toPath,
            ];
            loop.pinnedTargets = loop.pinnedTargets.filter(
              (p) => p.path !== data.fromPath,
            );
            loop = completeCurrentSubtaskAfterVerify(loop, data.toPath);
          }
        }
        break;
      }

      default:
        break;
    }
  }

  if (wroteThisBatch && lastWrittenPath && mode === "normal") {
    const verify = await runAutoVerify(workPath, lastWrittenPath, loop);
    verifyMessages.push(verify.message);
    loop = verify.workLoop;
  }

  if (loop.stepCount >= loop.maxSteps && !loop.escalateReason) {
    loop.escalateReason = "步数已达上限，我先总结目前已完成的部分。";
  }

  return { workLoop: loop, verifyMessages };
}

async function runAutoVerify(
  workPath: string,
  path: string,
  workLoop: WorkLoopState,
): Promise<{
  workLoop: WorkLoopState;
  message: { tool: string; content: string; args?: Record<string, unknown> };
}> {
  let loop = { ...workLoop };
  const verifySubtaskId = loop.currentSubtaskId;

  try {
    const absPath = resolveWorkspaceFilePath(workPath, path);
    const name = path.split("/").pop() ?? path;
    if (!isTextFile(name)) {
      throw new Error("FILE_NOT_READABLE");
    }

    const full = await readFile(absPath, "utf8");
    loop.readCache[path] = {
      hash: hashWorkspaceContent(full),
      excerpt: full.slice(0, 400),
      readCount: (loop.readCache[path]?.readCount ?? 0) + 1,
    };
    if (!loop.visitedPaths.includes(path)) {
      loop.visitedPaths.push(path);
    }
    loop.verifyAttempts = 0;
    loop.lastWrittenPath = undefined;
    loop = completeCurrentSubtaskAfterVerify(loop, path);

    const payload = {
      ok: true,
      tool: "auto_verify",
      summary: `verified ${path}`,
      data: { path, bytes: full.length, preview: full.slice(0, 300) },
    };
    loop = appendActivity(loop, {
      subtaskId: verifySubtaskId,
      stage: "verify",
      action: "auto_verify",
      ...buildActivityLabel("auto_verify", { path }, payload),
      status: "done",
    });

    return {
      workLoop: loop,
      message: {
        tool: "auto_verify",
        content: JSON.stringify(payload),
        args: { path },
      },
    };
  } catch {
    loop.verifyAttempts += 1;
    if (loop.verifyAttempts > loop.maxVerifyRetries) {
      loop.escalateReason = `写入验证失败：${path}`;
    }
    const payload = {
      ok: false,
      tool: "auto_verify",
      summary: `verify error for ${path}`,
      code: "VERIFY_ERROR",
      data: { path },
    };
    loop = appendActivity(loop, {
      subtaskId: verifySubtaskId,
      stage: "verify",
      action: "auto_verify",
      ...buildActivityLabel("auto_verify", { path }, payload),
      status: "error",
    });
    return {
      workLoop: loop,
      message: {
        tool: "auto_verify",
        content: JSON.stringify(payload),
        args: { path },
      },
    };
  }
}
