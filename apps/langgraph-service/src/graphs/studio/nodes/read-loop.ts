import type { RunnableConfig } from "@langchain/core/runnables";

import { requireWorkPathFromConfig } from "../../../mcp/work-path.js";
import type { TaskResult } from "@story-studio/shared/task-types";
import { formatReadTaskPrompt } from "../prompts.js";
import type { StudioGraphState } from "../state.js";
import { runToolLoop } from "../tool-loop.js";

const READ_SYSTEM = `你是 Story Studio 阅读助手。
上方 prompt 已提供作品概览与文件摘要，优先使用已有上下文。
仅在需要精确原文或摘要未覆盖的细节时，才调用 read_file。
禁止修改或删除文件。
输出结构化的阅读摘要，包含关键内容与文件路径。`;

export async function readLoopNode(
  state: StudioGraphState,
  config: RunnableConfig,
): Promise<Partial<StudioGraphState>> {
  const task = state.taskQueue[state.taskIndex];
  if (!task) {
    throw new Error("READ_TASK_MISSING");
  }

  const workPath = requireWorkPathFromConfig(config);
  const { text } = await runToolLoop({
    workPath,
    profile: "read-only",
    systemPrompt: READ_SYSTEM,
    userPrompt: formatReadTaskPrompt(task, state.taskResults, state.projectContext),
    maxToolRounds: 12,
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
