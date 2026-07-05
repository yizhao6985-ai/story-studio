import { composeSystemPrompt } from "#agent/shared/system-prompt.js";
import type { TurnRoute } from "#agent/graph/state.js";
import type { AgentMode } from "../../../../src/lib/story/types.js";
import {
  formatWorkLoopForPrompt,
  type WorkLoopState,
} from "#agent/shared/work-loop/types.js";

const SYNTHESIZE_MARKDOWN_HINT =
  "最终回复须使用 Markdown 格式（段落、列表、**加粗** 等），便于界面渲染；结构清晰即可，不要过度标题化。";

function formatActivitySummary(workLoop: WorkLoopState | null | undefined): string {
  if (!workLoop?.activityLog.length) return "";

  const lines = workLoop.activityLog
    .filter((e) => e.stage !== "plan")
    .slice(-16)
    .map((e) => {
      const pathPart = e.path ? ` · ${e.path}` : "";
      const detailPart = e.detail ? ` — ${e.detail}` : "";
      return `- ${e.label}${pathPart}${detailPart}`;
    });

  return lines.length > 0 ? `\n本轮执行摘要（供汇总，勿逐条复述工具步骤）：\n${lines.join("\n")}` : "";
}

function buildDirectSynthesizeModePrompt(): string {
  return `请直接回应用户本轮消息，保持 Story Studio 身份与语气。
本轮未使用工具探索作品，不要假设已读过文件或执行过改稿。
${SYNTHESIZE_MARKDOWN_HINT}`;
}

function buildSynthesizeModePrompt(
  mode: AgentMode,
  workLoop: WorkLoopState | null | undefined,
): string {
  const loopBlock = formatWorkLoopForPrompt(workLoop);
  const activitySummary = formatActivitySummary(workLoop);
  const taskSummary =
    workLoop && workLoop.subtasks.length > 0
      ? `\n子任务状态：${workLoop.subtasks.map((s, i) => `${i + 1}. ${s.intent}（${s.status}）`).join("；")}`
      : "";

  switch (mode) {
    case "ask":
      return `请根据本轮探索结果，向用户给出**具体、可执行**的汇总回复：
- 说明查到了什么、关键结论与建议（2～4 段或分点，不可只用「已完成」带过）
- 若读过/分析过具体文件，点明路径与要点
- 不要提及工具名与内部阶段
${SYNTHESIZE_MARKDOWN_HINT}
${workLoop?.escalateReason ? `注意：${workLoop.escalateReason}` : ""}
${taskSummary}
${activitySummary}

${loopBlock}`;

    default:
      return `请向用户汇总本轮创作结果（**必须具体**）：
- 说明完成了什么、改了哪些文件、内容/结构如何调整
- 若有设定整合，概括最终框架要点（3～5 条）
- 你是助手汇报结果，不是用户；禁止复述用户原话或替用户续话
${SYNTHESIZE_MARKDOWN_HINT}
${workLoop?.escalateReason ? `注意：${workLoop.escalateReason}` : ""}
${taskSummary}
${activitySummary}

${loopBlock}`;
  }
}

export function buildSynthesizeSystemPrompt(
  mode: AgentMode,
  workLoop: WorkLoopState | null | undefined,
  turnRoute: TurnRoute | null = "workLoop",
): string {
  if (turnRoute === "direct") {
    return composeSystemPrompt(buildDirectSynthesizeModePrompt());
  }
  return composeSystemPrompt(buildSynthesizeModePrompt(mode, workLoop));
}
