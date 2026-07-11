import type { SubTask, TaskResult } from "@story-studio/shared/task-types";

export function formatIntentPrompt(userMessage: string, mode: "ask" | "normal"): string {
  const modeHint =
    mode === "ask"
      ? "当前对话为「提问模式」：只能生成 read / answer 子任务，禁止 create / edit / delete。"
      : "当前对话为「创作模式」：可生成 read / answer / create / edit / delete 子任务。";

  return `【用户消息】
${userMessage}

【模式约束】
${modeHint}

请分析用户意图，输出 summary、needsClarification、clarificationQuestion（可选）、subTasks。
- read：需要阅读文件获取信息
- answer：直接回答或总结（可结合 read 结果）
- create：新建文件或目录
- edit：修改已有文件
- delete：删除文件或目录（仅当用户明确要求删除；targets 必须列出具体路径）

若意图不清，设 needsClarification=true 并给出 clarificationQuestion。
混合意图拆成多个有序子任务。`;
}

export function formatAskTaskPrompt(task: SubTask, priorResults: TaskResult[]): string {
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

  return `【Ask 子任务】
类型：${task.type}
目标：${task.goal}
范围：${scope}

【已完成子任务上下文】
${context}

请使用只读工具完成本任务，最后用简洁中文给出结果。`;
}

export function formatEditTaskPrompt(task: SubTask, priorResults: TaskResult[]): string {
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
      ? "\n【删除安全】仅删除 targets 中列出的路径，删除前用 read_file 确认，不要扩大范围。"
      : "";

  return `【Edit 子任务】
类型：${task.type}
目标：${task.goal}
范围：${scope}
目标路径：${targets}${deleteNote}

【已完成子任务上下文】
${context}

请使用工具完成任务：先读清上下文，再执行修改，最后自检并简要说明改动。`;
}

export function formatSummarizePrompt(
  userMessage: string,
  intentSummary: string,
  results: TaskResult[],
  clarificationQuestion?: string,
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

  return `【用户消息】
${userMessage}

【意图摘要】
${intentSummary}

【子任务执行结果】
${resultText}

请用简洁中文回复用户，整合以上结果。不要重复冗长工具输出。`;
}
