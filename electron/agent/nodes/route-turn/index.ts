import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";
import { invokeStructured } from "#agent/llm/structured.js";
import { createChatModel } from "#agent/llm/chat-model.js";
import { messageContentToText } from "#agent/messages/content.js";
import { messagesToChatHistory } from "#agent/messages/history.js";

import {
  formatConversationForRouting,
  ROUTE_TURN_SYSTEM_PROMPT,
} from "./prompt.js";

const RouteSchema = z.object({
  requiresWorkLoop: z
    .boolean()
    .describe("是否需要启动作品探索/读写工作循环"),
});

function lastUserMessageText(state: AgentStateType): string {
  const messages = state.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (HumanMessage.isInstance(message)) {
      return messageContentToText(message.content).trim();
    }
  }
  return "";
}

function buildRoutingUserMessage(state: AgentStateType, userText: string): string {
  const history = messagesToChatHistory(state.messages ?? []);
  const recent = history.slice(-8);
  const sections: string[] = [];

  if (state.conversationSummary?.trim()) {
    sections.push(`较早对话摘要：\n${state.conversationSummary.trim()}`);
  }

  sections.push(
    `最近对话：\n${formatConversationForRouting(
      recent.map((item) => ({
        role: item.role,
        text: item.text,
      })),
    )}`,
  );
  sections.push(`请判断最后一条用户消息是否需要 workLoop：\n${userText}`);

  return sections.join("\n\n");
}

export async function routeTurnNode(
  state: AgentStateType,
  config: RunnableConfig,
): Promise<AgentStatePatch> {
  const userText = lastUserMessageText(state);
  if (!userText) {
    return { turnRoute: "direct" };
  }

  try {
    const llm = createChatModel({ temperature: 0.1 });
    const parsed = await invokeStructured(
      llm,
      RouteSchema,
      [
        new SystemMessage(ROUTE_TURN_SYSTEM_PROMPT),
        new HumanMessage(buildRoutingUserMessage(state, userText)),
      ],
      { name: "route_turn", maxAttempts: 2 },
      config,
    );

    return {
      turnRoute: parsed.requiresWorkLoop ? "workLoop" : "direct",
    };
  } catch {
    return { turnRoute: "workLoop" };
  }
}
