import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

import { invokeStructured } from "#agent/llm/structured.js";
import { createChatModel } from "#agent/llm/chat-model.js";
import { messageContentToText } from "#agent/messages/content.js";
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
    .max(8),
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
      [new SystemMessage(PLAN_TASKS_SYSTEM_PROMPT), new HumanMessage(userText)],
      { name: "plan_tasks", maxAttempts: 2 },
      config,
    );

    const intents = parsed.tasks.map((t) => t.intent.trim()).filter(Boolean);
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
