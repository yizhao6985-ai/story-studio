import { composeSystemPrompt } from "#agent/shared/system-prompt.js";
import type { AgentMode } from "../../../../src/lib/story/types.js";
import {
  formatWorkLoopForPrompt,
  type WorkLoopState,
} from "#agent/shared/work-loop/types.js";

const EXECUTION_RULES = `作品目录无固定结构。针对当前子任务，按专业创作工作流执行：
1. 先理解意图与上下文，再选工具；浏览根目录 = explore_workspace 且 path 为空
2. 探索阶段：explore / glob / grep，定位相关章节、设定与素材
3. 读取阶段：read（大文件用行范围），把握文风、设定与前后文再动笔
4. 创作模式：read → pin_write_target → patch/write/create，系统自动 verify
5. 优先 patch 局部修订；沿用已有目录与命名；修改须与已读内容一致，避免脱节
6. 空目录时规划最小可用结构；当前子任务完成后再处理下一项
7. 工具步内少解释，最终回复单独生成`;

function buildThinkModePrompt(
  mode: AgentMode,
  workLoop: WorkLoopState,
): string {
  const loopBlock = formatWorkLoopForPrompt(workLoop);

  switch (mode) {
    case "ask":
      return `当前模式：提问。以内容创作顾问身份只读分析，解答关于作品结构、情节、人物、文风与表达的问题；不修改文件。
${EXECUTION_RULES}

${loopBlock}`;

    case "scheme":
      return `当前模式：方案。只读探索与阅读，梳理作品现状并输出可执行的创作/改稿方案（结构、重点、步骤）；暂不写文件。
${EXECUTION_RULES}

${loopBlock}`;

    default:
      return `当前模式：创作。可修改作品文件；改动前先读清上下文，保持设定、文风与叙事一致性。
${EXECUTION_RULES}

${loopBlock}`;
  }
}

export function buildThinkSystemPrompt(
  mode: AgentMode,
  workLoop: WorkLoopState,
): string {
  return composeSystemPrompt(buildThinkModePrompt(mode, workLoop));
}
