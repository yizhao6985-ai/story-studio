import { SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

import { getAgentEnv } from "#agent/llm/env.js";
import { streamChat } from "#agent/llm/stream.js";
import { createChatModel } from "#agent/llm/chat-model.js";
import { prepareChatMessagesForLlm } from "#agent/messages/prepare.js";
import { buildSynthesizeSystemPrompt } from "./prompt.js";
import { buildAssistantTurnKwargs } from "#agent/messages/turn-meta.js";
import { emitAgentActivity } from "#agent/runtime/activity.js";
import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";
import { createInitialWorkLoop } from "#agent/shared/work-loop/types.js";
import { finalizeSubtasksOnCompletion } from "../advance-subtask/subtasks.js";

export async function synthesizeNode(
  state: AgentStateType,
  config: RunnableConfig,
): Promise<AgentStatePatch> {
  const workLoop = finalizeSubtasksOnCompletion(
    state.workLoop ?? createInitialWorkLoop(),
  );
  const system = buildSynthesizeSystemPrompt(
    state.mode,
    workLoop,
    state.turnRoute,
  );

  const llm = createChatModel({ temperature: getAgentEnv().llmTemperature });
  const turnMeta = buildAssistantTurnKwargs({
    activityLog: workLoop.activityLog,
    subtasks: workLoop.subtasks.map((s) => ({
      id: s.id,
      intent: s.intent,
      status: s.status,
    })),
  });
  const response = await streamChat(
    llm,
    [new SystemMessage(system), ...prepareChatMessagesForLlm(state)],
    config,
    {
      additionalKwargs: turnMeta,
      onTextDelta: (delta) => emitAgentActivity({ type: "reply_delta", delta }),
    },
  );

  return { messages: [response] };
}
