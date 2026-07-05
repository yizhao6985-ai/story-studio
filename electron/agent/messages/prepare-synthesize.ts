import { HumanMessage, type BaseMessage } from "@langchain/core/messages";

import type { AgentStateType } from "#agent/graph/state.js";
import { messageContentToText } from "./content.js";
import { buildSummarySystemMessage } from "./context-usage.js";
import {
  filterCompletedTurnVisibleMessages,
  findLastHumanIndexInMessages,
  findMessageIndexById,
} from "./context-usage.js";
import { isTurnActivityMessage } from "./turn-meta.js";

function lastUserMessageText(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (HumanMessage.isInstance(message)) {
      return messageContentToText(message.content).trim();
    }
  }
  return "";
}

/**
 * synthesize 专用上下文：不含 tool/internal 消息，且不把「当前用户句」当作待回复模板。
 */
export function prepareSynthesizeMessagesForLlm(
  state: AgentStateType,
): BaseMessage[] {
  const filtered = (state.messages ?? []).filter(
    (message) => !isTurnActivityMessage(message),
  );

  const summaryCutoff = findMessageIndexById(
    filtered,
    state.summaryThroughMessageId,
  );
  const afterSummary =
    summaryCutoff >= 0 ? filtered.slice(summaryCutoff + 1) : filtered;

  const lastHumanIdx = findLastHumanIndexInMessages(afterSummary);
  const priorMessages =
    lastHumanIdx >= 0 ? afterSummary.slice(0, lastHumanIdx) : afterSummary;
  const userGoal =
    lastHumanIdx >= 0
      ? messageContentToText(afterSummary[lastHumanIdx]!.content).trim()
      : lastUserMessageText(afterSummary);

  const parts: BaseMessage[] = [];
  if (state.conversationSummary) {
    parts.push(buildSummarySystemMessage(state.conversationSummary));
  }
  parts.push(...filterCompletedTurnVisibleMessages(priorMessages));

  parts.push(
    new HumanMessage(
      [
        "【请基于本轮作品库操作结果，向用户输出汇总回复】",
        userGoal ? `用户本轮目标：${userGoal}` : "用户本轮目标：（见上文对话）",
        "",
        "要求：",
        "- 以助手身份汇报已完成的工作、改动文件与内容要点",
        "- 禁止复述或模仿用户原话作为回复",
        "- 禁止替用户继续对话（如「好的，我这就…」）",
      ].join("\n"),
    ),
  );

  return parts;
}
