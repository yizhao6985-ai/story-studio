import { nanoid } from "nanoid";

import { TOOL_NAMES } from "./tool-gate.js";
import type {
  ActivityEntry,
  ActivityStage,
  ActivityStatus,
  WorkLoopState,
} from "./types.js";

function stageForTool(toolName: string): ActivityStage {
  switch (toolName) {
    case TOOL_NAMES.explore:
    case TOOL_NAMES.glob:
    case TOOL_NAMES.grep:
      return "explore";
    case TOOL_NAMES.read:
      return "read";
    case TOOL_NAMES.pin:
      return "target";
    case TOOL_NAMES.patch:
    case TOOL_NAMES.write:
    case TOOL_NAMES.create:
    case TOOL_NAMES.delete:
    case TOOL_NAMES.rename:
      return "act";
    case "auto_verify":
      return "verify";
    default:
      return "explore";
  }
}

export function buildActivityLabel(
  toolName: string,
  args: Record<string, unknown>,
  observation: Record<string, unknown>,
): { label: string; detail?: string; path?: string } {
  const path = typeof args.path === "string" ? args.path : undefined;
  const ok = observation.ok === true;
  const summary =
    typeof observation.summary === "string" ? observation.summary : undefined;
  const data =
    observation.data && typeof observation.data === "object"
      ? (observation.data as Record<string, unknown>)
      : undefined;

  switch (toolName) {
    case TOOL_NAMES.explore: {
      const explorePath = typeof args.path === "string" ? args.path : "";
      const label =
        explorePath === "" ? "浏览根目录" : `浏览目录 ${explorePath}`;
      return { label, detail: summary, path: explorePath || undefined };
    }
    case TOOL_NAMES.glob:
      return {
        label: "匹配文件",
        detail:
          typeof args.pattern === "string"
            ? `pattern: ${args.pattern}`
            : summary,
      };
    case TOOL_NAMES.grep:
      return {
        label: "搜索内容",
        detail:
          typeof args.query === "string" ? `「${args.query}」` : summary,
      };
    case TOOL_NAMES.read:
      return {
        label: "读取",
        detail: summary,
        path,
      };
    case TOOL_NAMES.pin:
      return {
        label: "定位写入目标",
        detail:
          typeof args.action === "string" ? String(args.action) : summary,
        path,
      };
    case TOOL_NAMES.patch:
      return { label: "局部修改", detail: summary, path };
    case TOOL_NAMES.write:
      return { label: "覆盖写入", detail: summary, path };
    case TOOL_NAMES.create:
      return { label: "新建文件", detail: summary, path };
    case TOOL_NAMES.delete:
      return { label: "删除", detail: summary, path };
    case TOOL_NAMES.rename: {
      const fromPath =
        typeof args.fromPath === "string" ? args.fromPath : undefined;
      const toPath =
        typeof args.toPath === "string"
          ? args.toPath
          : typeof data?.toPath === "string"
            ? data.toPath
            : undefined;
      return {
        label: "重命名",
        detail: fromPath && toPath ? `${fromPath} → ${toPath}` : summary,
        path: toPath,
      };
    }
    case "auto_verify":
      return {
        label: "验证写入",
        detail: ok ? "通过" : summary,
        path: typeof data?.path === "string" ? data.path : path,
      };
    default:
      return { label: toolName, detail: summary };
  }
}

export function appendActivity(
  workLoop: WorkLoopState,
  entry: Omit<ActivityEntry, "id">,
): WorkLoopState {
  return {
    ...workLoop,
    activityLog: [
      ...workLoop.activityLog,
      { ...entry, id: nanoid(8) },
    ],
  };
}

export function appendPlanActivity(
  workLoop: WorkLoopState,
  intents: string[],
): WorkLoopState {
  const detail =
    intents.length > 1
      ? intents.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : intents[0];
  return appendActivity(workLoop, {
    stage: "plan",
    action: "plan_tasks",
    label: intents.length > 1 ? `规划 ${intents.length} 个子任务` : "规划任务",
    detail,
    status: "done",
  });
}

export function hasActivityForSubtask(
  workLoop: WorkLoopState,
  subtaskId: string,
): boolean {
  return workLoop.activityLog.some(
    (e) => e.subtaskId === subtaskId && e.stage !== "plan",
  );
}

export function activityFromToolResult(input: {
  workLoop: WorkLoopState;
  toolName: string;
  args: Record<string, unknown>;
  content: string;
}): WorkLoopState {
  let observation: Record<string, unknown> = {};
  try {
    observation = JSON.parse(input.content) as Record<string, unknown>;
  } catch {
    observation = { ok: false, summary: input.content.slice(0, 200) };
  }

  const { label, detail, path } = buildActivityLabel(
    input.toolName,
    input.args,
    observation,
  );
  const status: ActivityStatus = observation.ok === false ? "error" : "done";

  return appendActivity(input.workLoop, {
    subtaskId: input.workLoop.currentSubtaskId,
    stage: stageForTool(input.toolName),
    action: input.toolName,
    label,
    detail,
    path,
    status,
  });
}
