import type { RunnableConfig } from "@langchain/core/runnables";

import { requireWorkPathFromConfig } from "../../../mcp/work-path.js";
import type { TaskResult } from "@story-studio/shared/task-types";
import { formatAskTaskPrompt } from "../prompts.js";
import type { StudioGraphState } from "../state.js";
import { runToolLoop } from "../tool-loop.js";

const ASK_SYSTEM = `你是 Story Studio 阅读助手。
使用只读工具浏览作品文件并回答问题。禁止修改或删除文件。
用简洁中文给出结论。`;

export async function askLoopNode(
  state: StudioGraphState,
  config: RunnableConfig,
): Promise<Partial<StudioGraphState>> {
  const task = state.taskQueue[state.taskIndex];
  if (!task) {
    throw new Error("ASK_TASK_MISSING");
  }

  const workPath = requireWorkPathFromConfig(config);
  const { text } = await runToolLoop({
    workPath,
    profile: "read-only",
    systemPrompt: ASK_SYSTEM,
    userPrompt: formatAskTaskPrompt(task, state.taskResults),
    maxSteps: 10,
    abortSignal: config.signal ?? undefined,
  });

  const result: TaskResult = {
    task,
    output: text,
    changedFiles: [],
  };

  return {
    taskResults: [...state.taskResults, result],
  };
}
