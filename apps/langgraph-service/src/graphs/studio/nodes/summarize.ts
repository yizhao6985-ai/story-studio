import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

import { createChatModel } from "../../../platform/llm.js";
import { formatSummarizePrompt } from "../prompts.js";
import type { StudioGraphState } from "../state.js";
import { getLastHumanMessageText } from "./prepare.js";

export async function summarizeNode(
  state: StudioGraphState,
): Promise<Partial<StudioGraphState>> {
  const userMessage =
    state.userMessage?.trim() || getLastHumanMessageText(state.messages);
  const model = createChatModel({ temperature: 0.3, disableThinking: true });
  const response = await model.invoke([
    new SystemMessage(
      "你是 Story Studio 对话助手。用简洁、自然的中文回复用户，整合子任务结果。",
    ),
    new HumanMessage(
      formatSummarizePrompt(
        userMessage,
        state.intent?.summary ?? userMessage,
        state.taskResults,
        state.intent?.needsClarification
          ? state.intent.clarificationQuestion
          : undefined,
        state.projectContext,
      ),
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

  return {
    messages: [new AIMessage(text)],
  };
}
