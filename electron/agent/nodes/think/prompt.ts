import { composeSystemPrompt } from "#agent/shared/system-prompt.js";
import type { AgentMode } from "../../../../src/lib/story/types.js";
import {
  formatWorkLoopForPrompt,
  type WorkLoopState,
} from "#agent/shared/work-loop/types.js";

const EXECUTION_RULES = `作品目录无固定结构。针对「当前子任务」完成探索→读取→（创作模式下）定位→写入全流程：
- 浏览：explore_workspace（根目录 path 留空）
- 匹配/搜索：glob_workspace、grep_workspace
- 读取：read_workspace_file
- 创作模式写入：pin_write_target → patch / write / create / delete / rename_workspace_entry
- 当前子任务未完成前须继续调用工具；最终面向用户的汇总由 synthesize 节点单独生成，think 步不要写长段解释`;

function buildThinkModePrompt(
  mode: AgentMode,
  workLoop: WorkLoopState,
): string {
  const loopBlock = formatWorkLoopForPrompt(workLoop);

  switch (mode) {
    case "ask":
      return `当前模式：提问。只读分析，不修改文件。
${EXECUTION_RULES}

${loopBlock}`;

    default:
      return `当前模式：创作。可修改作品文件；保持设定、文风与叙事一致性。
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
