import type { SubTask, TaskResult } from "@story-studio/shared/task-types";

import { formatWorkContextBlock } from "../../context/format.js";
import type { RelevantContext } from "../../context/types.js";

export function formatIntentPrompt(
  userMessage: string,
  mode: "ask" | "normal",
  projectContext?: RelevantContext,
): string {
  const modeHint =
    mode === "ask"
      ? "当前对话为「提问模式」：只能生成 read / answer 子任务，禁止 create / edit / delete。"
      : "当前对话为「创作模式」：可生成 read / answer / create / edit / delete 子任务。";

  return `${formatWorkContextBlock(projectContext)}

【用户消息】
${userMessage}

【模式约束】
${modeHint}

【上下文使用规则】
- 上方已提供作品概览、相关文件摘要与完整文件索引。
- 优先基于已有作品上下文回答或规划任务，不要默认生成 read 子任务。
- 仅在需要精确原文、段落细节、或摘要未覆盖的内容时，才生成 read 子任务，并在 scope 中指定具体路径。

请分析用户意图，输出 JSON 对象，字段如下：
- summary: string（意图摘要）
- needsClarification: boolean
- clarificationQuestion?: string（仅 needsClarification=true 时填写）
- subTasks: 有序子任务数组；每个子任务必须包含 type 与 goal（goal 为必填字符串，描述该子任务要完成什么）

子任务 type 说明：
- read：仅在已有摘要不足时，读取指定文件的精确内容
- answer：基于作品上下文或 read 结果回答用户（ask 路径终点）
- create：新建文件或目录（edit 路径）
- edit：修改已有文件（edit 路径）
- delete：删除文件或目录（仅当用户明确要求删除；targets 必须列出具体路径）

编排规则：
- 作品上下文已足够回答 → 直接 answer
- 需要精确原文或细节 → read（指定 scope），再 answer / edit
- 需要了解现状才能修改 → 若摘要不足则 read，再 create / edit / delete
- 纯知识问答、不涉及作品文件 → 仅 answer
- 明确路径的新建 → 可仅 create（无需 read）

示例：
{
  "summary": "用户想了解第三章内容",
  "needsClarification": false,
  "subTasks": [
    { "type": "answer", "goal": "基于作品上下文说明第三章主要内容" }
  ]
}

若意图不清，设 needsClarification=true 并给出 clarificationQuestion。
混合意图拆成多个有序子任务。`;
}

export function formatReadTaskPrompt(
  task: SubTask,
  priorResults: TaskResult[],
  projectContext?: RelevantContext,
): string {
  const context =
    priorResults.length > 0
      ? priorResults
          .map(
            (result) =>
              `[${result.task.type}] ${result.task.goal}\n${result.output.slice(0, 1500)}`,
          )
          .join("\n\n")
      : "（无）";

  const scope =
    task.scope && task.scope.length > 0 ? task.scope.join("、") : "按需探索";

  return `${formatWorkContextBlock(projectContext)}

【Read 子任务】
类型：${task.type}
目标：${task.goal}
范围：${scope}

【已完成子任务上下文】
${context}

优先使用上方作品上下文；仅在 scope 内需要精确原文时再调用 read_file。输出结构化的阅读摘要。`;
}

export function formatEditTaskPrompt(
  task: SubTask,
  priorResults: TaskResult[],
  projectContext?: RelevantContext,
): string {
  const context =
    priorResults.length > 0
      ? priorResults
          .map(
            (result) =>
              `[${result.task.type}] ${result.task.goal}\n${result.output.slice(0, 1500)}`,
          )
          .join("\n\n")
      : "（无）";

  const scope =
    task.scope && task.scope.length > 0 ? task.scope.join("、") : "按需收窄";
  const targets =
    task.targets && task.targets.length > 0
      ? task.targets.join("、")
      : "（未指定，按目标推断）";

  const deleteNote =
    task.type === "delete"
      ? "\n【删除安全】仅删除 targets 中列出的路径，不要扩大范围。"
      : "";

  return `${formatWorkContextBlock(projectContext)}

【Edit 子任务】
类型：${task.type}
目标：${task.goal}
范围：${scope}
目标路径：${targets}${deleteNote}

【已完成子任务上下文】
${context}

作品上下文与阅读结果已在上方提供，直接执行变更操作，完成后自检并简要说明改动。`;
}

export function formatRespondPrompt(
  userMessage: string,
  intentSummary: string,
  results: TaskResult[],
  clarificationQuestion?: string,
  projectContext?: RelevantContext,
): string {
  if (clarificationQuestion) {
    return `用户说：${userMessage}

需要向用户澄清：${clarificationQuestion}

请用简洁友好的中文向用户提问，不要执行任何文件操作。`;
  }

  const resultText =
    results.length > 0
      ? results
          .map(
            (result) =>
              `### ${result.task.type}: ${result.task.goal}\n${result.output.slice(0, 2000)}`,
          )
          .join("\n\n")
      : "（无子任务结果）";

  return `${formatWorkContextBlock(projectContext)}

【用户消息】
${userMessage}

【意图摘要】
${intentSummary}

【子任务执行结果】
${resultText}

请用简洁中文回复用户，整合以上结果。不要重复冗长工具输出。`;
}
