import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

import { createChatModel } from "../agent/llm/chat-model.js";
import { invokeStructured } from "../agent/llm/structured.js";
import {
  DEFAULT_CONVERSATION_TITLE,
  getConversationById,
  updateConversationTitle,
} from "./conversation-store.js";

const TitleSchema = z.object({
  title: z
    .string()
    .min(2)
    .max(24)
    .describe("侧边栏显示的简短中文标题，不含引号与句末标点"),
});

export const CONVERSATION_TITLE_SYSTEM_PROMPT = `你是对话标题生成器，服务于 Story Studio 内容创作协作。
根据用户首条消息与助手回复，生成一个简短中文标题，用于左侧对话列表展示。

要求：
- 6–16 字为宜，最多不超过 24 字
- 概括对话主题与创作意图，不要照搬原文
- 不要加引号，不要以句号、问号、感叹号结尾
- 不要用「对话」「关于」「新对话」等泛化前缀
- 可保留章节、人物、大纲、设定等创作相关关键词`;

const DISALLOWED_TITLES = new Set([
  DEFAULT_CONVERSATION_TITLE,
  "对话",
  "未命名",
  "未命名对话",
  "新会话",
  "聊天",
]);

function trimReplyForPrompt(reply: string, maxChars = 1200): string {
  const trimmed = reply.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}…`;
}

function normalizeGeneratedTitle(raw: string): string {
  return raw.trim().replace(/^["「『]|["」』]$/g, "").slice(0, 24);
}

function isUsableConversationTitle(title: string): boolean {
  const normalized = normalizeGeneratedTitle(title);
  if (normalized.length < 2) return false;
  if (DISALLOWED_TITLES.has(normalized)) return false;
  return true;
}

export async function generateConversationTitle(
  userMessage: string,
  assistantReply: string,
  config?: RunnableConfig,
): Promise<string> {
  const userText = userMessage.trim();
  const replyText = trimReplyForPrompt(assistantReply);
  if (!userText || !replyText) {
    throw new Error("CONVERSATION_TITLE_EMPTY_INPUT");
  }

  const llm = createChatModel({ temperature: 0.2 });
  const parsed = await invokeStructured(
    llm,
    TitleSchema,
    [
      new SystemMessage(CONVERSATION_TITLE_SYSTEM_PROMPT),
      new HumanMessage(
        [
          "用户：",
          userText,
          "",
          "助手：",
          replyText,
        ].join("\n"),
      ),
    ],
    { name: "conversation_title", maxAttempts: 1 },
    config,
  );

  const title = normalizeGeneratedTitle(parsed.title);
  if (!isUsableConversationTitle(title)) {
    throw new Error("CONVERSATION_TITLE_NOT_USABLE");
  }
  return title;
}

export async function maybeAutoTitleConversation(input: {
  workPath: string;
  conversationId: string;
  userMessage: string;
  assistantReply: string;
}): Promise<void> {
  const reply = input.assistantReply.trim();
  if (!reply || reply === "（无回复）") return;

  const conversation = await getConversationById(
    input.workPath,
    input.conversationId,
  );
  if (!conversation || conversation.title !== DEFAULT_CONVERSATION_TITLE) {
    return;
  }

  try {
    const title = await generateConversationTitle(input.userMessage, reply);
    await updateConversationTitle(input.workPath, input.conversationId, title);
  } catch {
    // 标题生成失败时保持「新对话」，不阻塞主流程
  }
}
