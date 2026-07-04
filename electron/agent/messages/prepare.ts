import {
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  extractAttachmentAssetsFromContent,
  extractPreviewSelectionsFromContent,
  isHumanAssetContentPart,
  isHumanPreviewSelectionPart,
  previewSelectionsSummary,
} from "./human.js";
import { isTurnActivityMessage } from "./turn-meta.js";
import { selectMessagesForLlm } from "./context-usage.js";

import { messageContentToText } from "./content.js";
import type { AgentStateType } from "#agent/graph/state.js";

function attachmentLabel(count: number): string {
  if (count === 1) return "[用户附带了 1 份参考素材]";
  return `[用户附带了 ${count} 份参考素材]`;
}

function humanContentNeedsSanitize(content: HumanMessage["content"]): boolean {
  if (typeof content === "string") return false;
  if (!Array.isArray(content)) return false;

  return content.some((part) => {
    if (typeof part === "string") return false;
    if (!part || typeof part !== "object") return true;
    if (isHumanAssetContentPart(part)) return true;
    if (isHumanPreviewSelectionPart(part)) return true;
    return !("type" in part);
  });
}

/** 将含附件块的 human 消息压成纯文本，供 Qwen 等非多模态 Chat 使用。 */
function sanitizeHumanMessageForTextChat(
  message: HumanMessage,
): HumanMessage {
  if (!humanContentNeedsSanitize(message.content)) return message;

  let text = messageContentToText(message.content).trim();
  const attachmentCount = extractAttachmentAssetsFromContent(
    message.content,
  ).length;
  const previewSelections = extractPreviewSelectionsFromContent(
    message.content,
  );
  const selectionSummary = previewSelectionsSummary(previewSelections);

  const prefixes = [
    attachmentCount > 0 ? attachmentLabel(attachmentCount) : "",
    selectionSummary,
  ].filter(Boolean);

  if (prefixes.length > 0) {
    const prefixBlock = prefixes.join("\n");
    text = text ? `${prefixBlock}\n${text}` : prefixBlock;
  }

  return new HumanMessage({
    id: message.id,
    name: message.name,
    content: text,
  });
}

/** 过滤消息列表中不兼容文本 Chat API 的 human content part。 */
export function sanitizeMessagesForTextChat(
  messages: BaseMessage[],
): BaseMessage[] {
  return messages.map((message) =>
    HumanMessage.isInstance(message)
      ? sanitizeHumanMessageForTextChat(message)
      : message,
  );
}

/** 子图 llm-chat：滚动摘要 + 近期窗口 + human 附件压平。 */
export function prepareChatMessagesForLlm(
  state: AgentStateType,
): BaseMessage[] {
  const messages = selectMessagesForLlm(state).filter(
    (message) => !isTurnActivityMessage(message),
  );
  return sanitizeMessagesForTextChat(messages);
}
