import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

import { invokeStructured } from "#agent/llm/structured.js";
import { createChatModel } from "#agent/llm/chat-model.js";
import { messageContentToText } from "#agent/messages/content.js";
import { messagesToChatHistory } from "#agent/messages/history.js";
import type { AgentStateType } from "#agent/graph/state.js";

import { PLAN_TASKS_SYSTEM_PROMPT } from "./prompt.js";
import { appendPlanActivity } from "#agent/shared/work-loop/activity-log.js";
import { applyPlannedSubtasks } from "../advance-subtask/subtasks.js";
import type { WorkLoopState } from "#agent/shared/work-loop/types.js";

const PlanSchema = z.object({
  tasks: z
    .array(
      z.object({
        intent: z.string().min(1).describe("一个可独立完成的子任务描述"),
      }),
    )
    .min(1)
    .max(4),
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

function buildPlanUserMessage(state: AgentStateType, userText: string): string {
  const history = messagesToChatHistory(state.messages ?? []).slice(-8);
  const sections: string[] = [];

  if (state.conversationSummary?.trim()) {
    sections.push(`较早对话摘要：\n${state.conversationSummary.trim()}`);
  }

  if (history.length > 1) {
    const lines = history
      .slice(0, -1)
      .map((item) => {
        if (item.role === "user") return `用户：${item.text}`;
        if (item.role === "delegate") return `代理：${item.text}`;
        return `助手：${item.text}`;
      })
      .filter(Boolean);
    if (lines.length) {
      sections.push(`最近对话：\n${lines.join("\n")}`);
    }
  }

  sections.push(`本轮用户消息：\n${userText}`);
  return sections.join("\n\n");
}

function collapsePlanIntents(intents: string[]): string[] {
  const trimmed = intents.map((t) => t.trim()).filter(Boolean);
  if (trimmed.length <= 1) return trimmed.length ? trimmed : ["处理用户请求"];

  const readLike = /读|梳理|了解|探索|分析|查看|把握/;
  const writeLike = /写|改|融入|整合|补充|创建|修订|精简|删除|覆盖|patch/i;
  const hasRead = trimmed.some((t) => readLike.test(t));
  const hasWrite = trimmed.some((t) => writeLike.test(t));

  if (hasRead && hasWrite && trimmed.length <= 4) {
    return [trimmed.join("；")];
  }

  return trimmed;
}

export async function planTasksForTurn(
  workLoop: WorkLoopState,
  state: AgentStateType,
  config: RunnableConfig,
): Promise<WorkLoopState> {
  const userText = lastUserMessageText(state);
  if (!userText) {
    return applyPlannedSubtasks(
      appendPlanActivity(workLoop, ["处理用户请求"]),
      ["处理用户请求"],
    );
  }

  try {
    const llm = createChatModel({ temperature: 0.2 });
    const parsed = await invokeStructured(
      llm,
      PlanSchema,
      [
        new SystemMessage(PLAN_TASKS_SYSTEM_PROMPT),
        new HumanMessage(buildPlanUserMessage(state, userText)),
      ],
      { name: "plan_tasks", maxAttempts: 2 },
      config,
    );

    const intents = collapsePlanIntents(
      parsed.tasks.map((t) => t.intent.trim()).filter(Boolean),
    );
    if (!intents.length) {
      throw new Error("EMPTY_PLAN");
    }

    return applyPlannedSubtasks(appendPlanActivity(workLoop, intents), intents);
  } catch {
    return applyPlannedSubtasks(appendPlanActivity(workLoop, [userText]), [
      userText,
    ]);
  }
}
