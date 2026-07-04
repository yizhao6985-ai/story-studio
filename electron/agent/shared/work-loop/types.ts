/**
 * 单轮工作循环（Work Loop）类型与工具函数
 *
 * 对应 AgentState.workLoop：每轮用户消息由 prepareTurn 重置，在 planTasks → think ↔
 * executeTools 之间演进。负责子任务拆解、文件读写追踪、工具门禁与 UI 活动日志。
 *
 * 典型生命周期：
 *   planTasks 生成 subtasks → think 决策 → executeTools 读写文件并更新 cache/pins
 *   → advanceSubtask 切换子任务 → 步数/校验超限则设置 escalateReason 走 escalate 节点
 */

/** UI 活动条与 activityLog 使用的阶段标签，映射自具体 tool 名称 */
export type ActivityStage =
  | "plan" // 任务规划
  | "explore" // 浏览目录结构
  | "read" // 读文件 / grep / glob
  | "target" // pin 写入目标
  | "act" // patch / write / create
  | "verify"; // 写入后自动校验

/** 单条活动记录的执行结果 */
export type ActivityStatus = "done" | "error";

/**
 * 一条可展示的工作步骤，runner 流式推给前端活动面板。
 *
 * executeTools 每执行一个 tool 追加一条；id 用于去重，避免重复 emit。
 */
export type ActivityEntry = {
  id: string;
  subtaskId?: string;
  stage: ActivityStage;
  action: string;
  label: string;
  detail?: string;
  path?: string;
  status: ActivityStatus;
};

/** 对作品的写操作类型，与 workspace 写工具及 tool-gate 规则对应 */
export type WriteAction = "patch" | "overwrite" | "create";

/**
 * planTasks 拆出的子任务，advanceSubtask 按序推进。
 *
 * normal 模式下 LLM 一次只聚焦 currentSubtaskId 对应项。
 */
export type SubTask = {
  id: string;
  intent: string;
  status: "pending" | "in_progress" | "done" | "failed";
  targetPath?: string;
  action?: WriteAction;
};

/**
 * 已确认的写入目标（pin_write_target 工具产出）。
 *
 * tool-gate 要求：写文件前必须先 read 且 pin 同路径；readHash 用于检测读后再改。
 */
export type PinnedTarget = {
  path: string;
  action: WriteAction;
  readHash?: string;
  reason?: string;
};

/**
 * 单文件读取缓存，避免重复读大文件并支撑「先读后写」门禁。
 *
 * key 为作品内相对路径；hash 为内容摘要，excerpt 供 prompt 引用。
 */
export type ReadCacheEntry = {
  hash: string;
  excerpt: string;
  readCount: number;
};

/**
 * 单轮工作循环的完整内存（不跨用户消息保留业务进度，仅当轮有效）。
 *
 * 各字段由 executeTools/post-update、advanceSubtask、routes 等节点读写。
 */
export type WorkLoopState = {
  /** 本轮回 think↔execute 已走步数，达 maxSteps 触发 escalate */
  stepCount: number;
  maxSteps: number;
  /** 本轮回已读过的相对路径列表（去重追加，prompt 只展示最近几条） */
  visitedPaths: string[];
  /** 路径 → 读取缓存，支撑 tool-gate 与 prompt 上下文 */
  readCache: Record<string, ReadCacheEntry>;
  /** 已通过 pin 确认的写入目标列表 */
  pinnedTargets: PinnedTarget[];
  /** 本轮任务清单，由 planTasks 初始化 */
  subtasks: SubTask[];
  /** 当前正在执行的子任务 id */
  currentSubtaskId?: string;
  /** 当前写入目标的连续校验失败次数 */
  verifyAttempts: number;
  maxVerifyRetries: number;
  /** 最近一次成功写入的路径，用于自动 verify */
  lastWrittenPath?: string;
  /**
   * 提前结束工作循环的原因；routes 检测到非空时会路由到 escalate 节点，
   * synthesize/escalate prompt 也会展示给用户。
   */
  escalateReason?: string;
  /** 本轮回所有 tool 步骤，供 UI 活动流展示 */
  activityLog: ActivityEntry[];
};

const WORK_LOOP_MAX_STEPS = 24;
const WORK_LOOP_MAX_VERIFY_RETRIES = 2;

/** prepareTurn 每轮调用，得到空的 WorkLoopState */
export function createInitialWorkLoop(): WorkLoopState {
  return {
    stepCount: 0,
    maxSteps: WORK_LOOP_MAX_STEPS,
    visitedPaths: [],
    readCache: {},
    pinnedTargets: [],
    subtasks: [],
    verifyAttempts: 0,
    maxVerifyRetries: WORK_LOOP_MAX_VERIFY_RETRIES,
    activityLog: [],
  };
}

/** 取 currentSubtaskId 对应的 SubTask，无 id 或未找到则 undefined */
export function getCurrentSubtask(
  workLoop: WorkLoopState,
): SubTask | undefined {
  if (!workLoop.currentSubtaskId) return undefined;
  return workLoop.subtasks.find((s) => s.id === workLoop.currentSubtaskId);
}

/** 无子任务视为已完成；否则全部 done 或 failed */
export function allSubtasksComplete(workLoop: WorkLoopState): boolean {
  if (!workLoop.subtasks.length) return true;
  return workLoop.subtasks.every(
    (s) => s.status === "done" || s.status === "failed",
  );
}

export function hasPendingSubtasks(workLoop: WorkLoopState): boolean {
  return workLoop.subtasks.some((s) => s.status === "pending");
}

/** 注入 think/synthesize system prompt 的工作循环摘要（中文可读） */
export function formatWorkLoopForPrompt(workLoop: WorkLoopState | null | undefined): string {
  if (!workLoop) {
    return "步数：0/24";
  }

  const lines = [`步数：${workLoop.stepCount}/${workLoop.maxSteps}`];

  if (workLoop.subtasks.length) {
    const current = getCurrentSubtask(workLoop);
    const idx = current
      ? workLoop.subtasks.findIndex((s) => s.id === current.id) + 1
      : 0;
    lines.push(
      `任务清单：${workLoop.subtasks.map((s, i) => `${i + 1}. ${s.intent}（${s.status}）`).join("；")}`,
    );
    if (current) {
      lines.push(`当前子任务 (${idx}/${workLoop.subtasks.length})：${current.intent}`);
    }
  }

  if (workLoop.pinnedTargets.length) {
    lines.push(
      `已定位写入目标：${workLoop.pinnedTargets.map((p) => `${p.path} (${p.action})`).join("；")}`,
    );
  }

  if (workLoop.visitedPaths.length) {
    lines.push(`已读文件：${workLoop.visitedPaths.slice(-8).join("、")}`);
  }

  return lines.join("\n");
}
