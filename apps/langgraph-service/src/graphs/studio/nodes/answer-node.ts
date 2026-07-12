import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { createChatModel } from "../../../platform/llm.js";
import type { TaskResult } from "@story-studio/shared/task-types";
import { formatAnswerTaskPrompt } from "../prompts.js";
import type { StudioGraphState } from "../state.js";

const ANSWER_SYSTEM = `你是 Story Studio 问答助手。
基于已完成子任务的阅读结果，用简洁中文回答用户问题。
不要调用任何工具，不要修改文件。`;

export async function answerNode(
  state: StudioGraphState,
): Promise<Partial<StudioGraphState>> {
  const task = state.taskQueue[state.taskIndex];
  if (!task) {
    throw new Error("ANSWER_TASK_MISSING");
  }

  const model = createChatModel({
    temperature: 0.3,
    disableThinking: true,
  }).withConfig({
    tags: ["nostream"],
  });
  const response = await model.invoke([
    new SystemMessage(ANSWER_SYSTEM),
    new HumanMessage(
      formatAnswerTaskPrompt(task, state.taskResults, state.projectContext),
    ),
  ]);

  const text =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? response.content
            .map((part) =>
              typeof part === "string"
                ? part
                : "text" in part
                  ? String(part.text)
                  : "",
            )
            .join("")
        : String(response.content);

  const result: TaskResult = {
    task,
    output: text,
    changedFiles: [],
  };

  return {
    taskResults: [...state.taskResults, result],
  };
}
