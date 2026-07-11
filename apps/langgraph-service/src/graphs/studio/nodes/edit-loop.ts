import type { RunnableConfig } from "@langchain/core/runnables";

import { requireWorkPathFromConfig } from "../../../mcp/work-path.js";
import type { TaskResult } from "@story-studio/shared/task-types";
import { formatEditTaskPrompt } from "../prompts.js";
import type { StudioGraphState } from "../state.js";
import { runToolLoop } from "../tool-loop.js";

const EDIT_SYSTEM = `你是 Story Studio 创作执行助手。
根据子任务目标使用工具读写作品文件。
流程：先读清相关文件 → 执行修改 → 自检是否完成。
保持原有文风与格式。
delete 类型：仅删除任务指定的 targets，删除前必须 read_file 确认。
非 delete 任务不要删除文件。`;

export async function editLoopNode(
  state: StudioGraphState,
  config: RunnableConfig,
): Promise<Partial<StudioGraphState>> {
  const task = state.taskQueue[state.taskIndex];
  if (!task) {
    throw new Error("EDIT_TASK_MISSING");
  }

  const workPath = requireWorkPathFromConfig(config);
  const { text, changedFiles } = await runToolLoop({
    workPath,
    profile: "writer",
    systemPrompt: EDIT_SYSTEM,
    userPrompt: formatEditTaskPrompt(task, state.taskResults),
    maxSteps: 22,
    abortSignal: config.signal ?? undefined,
  });

  const result: TaskResult = {
    task,
    output: text,
    changedFiles,
  };

  return {
    taskResults: [...state.taskResults, result],
    changedFiles: [...new Set([...state.changedFiles, ...changedFiles])],
  };
}
