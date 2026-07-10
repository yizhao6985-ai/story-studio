import type {
  WritingExploreResult,
  WritingPlan,
  WritingTaskBrief,
} from "@story-studio/shared/writing-types";

export function formatPlanPrompt(brief: WritingTaskBrief): string {
  const scope =
    brief.scope.length > 0 ? brief.scope.join("、") : "（未限定，按需探索）";
  const constraints = brief.constraints?.trim() || "保持原有文风与格式";
  const hints = brief.contextHints?.trim();

  return `【写作任务简报】
目标：${brief.goal}
范围：${scope}
约束：${constraints}${hints ? `\n上下文提示：${hints}` : ""}

请制定写作计划（targets、strategy、risks）。`;
}

export function formatExplorePrompt(
  brief: WritingTaskBrief,
  plan: WritingPlan,
): string {
  return `【探索任务】
目标：${brief.goal}
计划策略：${plan.strategy}
关注文件：${plan.targets.join("、") || "按需探索"}

请阅读相关文件并返回结构化发现（路径、摘要、关键摘录）。`;
}

export function formatExecutePrompt(
  brief: WritingTaskBrief,
  plan: WritingPlan,
  explore: WritingExploreResult,
): string {
  const findings = explore.findings
    .map(
      (f: WritingExploreResult["findings"][number]) =>
        `- ${f.path}：${f.summary}${f.relevantExcerpt ? `（摘录：${f.relevantExcerpt.slice(0, 200)}）` : ""}`,
    )
    .join("\n");

  return `【执行任务】
目标：${brief.goal}
策略：${plan.strategy}
约束：${brief.constraints?.trim() || "保持原有文风与格式"}

探索发现：
${findings || "（无）"}

请委派子 Agent 完成文件修改，完成后汇总改动路径与摘要。`;
}

export function formatVerifyPrompt(
  brief: WritingTaskBrief,
  changedFiles: string[],
  changeSummary: string,
): string {
  return `【校验任务】
目标：${brief.goal}
已改文件：${changedFiles.join("、") || "（无）"}
改动摘要：${changeSummary}

请校验改动是否符合任务要求，列出问题（如有）。`;
}
