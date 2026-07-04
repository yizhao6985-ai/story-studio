import { composeSystemPrompt } from "#agent/shared/system-prompt.js";
import type { TurnRoute } from "#agent/graph/state.js";
import type { AgentMode } from "../../../../src/lib/story/types.js";
import {
  formatWorkLoopForPrompt,
  type WorkLoopState,
} from "#agent/shared/work-loop/types.js";

const SYNTHESIZE_MARKDOWN_HINT =
  "最终回复须使用 Markdown 格式（段落、列表、**加粗** 等），便于界面渲染；结构清晰即可，不要过度标题化。";

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
  const taskSummary =
    workLoop && workLoop.subtasks.length > 0
      ? `\n子任务状态：${workLoop.subtasks.map((s, i) => `${i + 1}. ${s.intent}（${s.status}）`).join("；")}`
      : "";

  switch (mode) {
    case "ask":
      return `请根据本轮探索结果，以专业内容创作 Agent 的视角回答用户：具体、有判断、可执行。不要提及工具名与内部阶段。
${SYNTHESIZE_MARKDOWN_HINT}
${workLoop?.escalateReason ? `注意：${workLoop.escalateReason}` : ""}
${taskSummary}

${loopBlock}`;

    case "scheme":
      return `请根据本轮探索结果，输出清晰的创作/改稿方案：现状判断、建议方向、可执行步骤。具体、有专业判断，不要提及工具名与内部阶段。
${SYNTHESIZE_MARKDOWN_HINT}
${workLoop?.escalateReason ? `注意：${workLoop.escalateReason}` : ""}
${taskSummary}

${loopBlock}`;

    default:
      return `请向用户说明本轮创作结果：逐项说明子任务完成情况，点明改了什么、为何这样改、有无待确认项。语气专业自然，不要工具腔。
${SYNTHESIZE_MARKDOWN_HINT}
${workLoop?.escalateReason ? `注意：${workLoop.escalateReason}` : ""}
${taskSummary}

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
