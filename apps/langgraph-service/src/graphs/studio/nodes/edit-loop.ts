import type { RunnableConfig } from "@langchain/core/runnables";

import { requireWorkPathFromConfig } from "../../../mcp/work-path.js";
import type { TaskResult } from "@story-studio/shared/task-types";
import { formatEditTaskPrompt } from "../prompts.js";
import type { StudioGraphState } from "../state.js";
import { runToolLoop } from "../tool-loop.js";

const EDIT_SYSTEM = `你是 Story Studio 创作执行助手。
阅读结果已在【已完成子任务上下文】中提供，优先使用已有上下文，不要重复读取。
直接根据上下文执行 create / edit / delete 操作，完成后自检并简要说明改动。
保持原有文风与格式。
delete 类型：仅删除任务指定的 targets，不要扩大范围。
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
    userPrompt: formatEditTaskPrompt(task, state.taskResults, state.projectContext),
    maxToolRounds: 22,
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
