import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

import { createChatModel } from "../../../platform/llm.js";
import { formatRespondPrompt } from "../prompts.js";
import type { StudioGraphState } from "../state.js";
import { getLastHumanMessageText } from "./prepare.js";

const RESPOND_SYSTEM = `你是 Story Studio 对话助手。
用简洁、自然的中文回复用户，整合子任务结果与作品上下文。
不要调用任何工具，不要修改文件。`;

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : "text" in part
            ? String(part.text)
            : "",
      )
      .join("");
  }
  return String(content ?? "");
}

export async function respondNode(
  state: StudioGraphState,
): Promise<Partial<StudioGraphState>> {
  const userMessage =
    state.userMessage?.trim() || getLastHumanMessageText(state.messages);
  const model = createChatModel({ temperature: 0.3, disableThinking: true }).withConfig(
    {
      tags: ["nostream"],
    },
  );
  const response = await model.invoke([
    new SystemMessage(RESPOND_SYSTEM),
    new HumanMessage(
      formatRespondPrompt(
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

  const text = extractMessageText(response.content);

  return {
    messages: [new AIMessage(text)],
  };
}
