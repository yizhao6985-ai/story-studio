import { AIMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

import { getAgentEnv } from "#agent/llm/env.js";
import { streamChat } from "#agent/llm/stream.js";
import { createChatModel } from "#agent/llm/chat-model.js";
import { messageContentToText } from "#agent/messages/content.js";
import { prepareSynthesizeMessagesForLlm } from "#agent/messages/prepare-synthesize.js";
import { buildSynthesizeSystemPrompt } from "./prompt.js";
import { buildAssistantTurnKwargs } from "#agent/messages/turn-meta.js";
import { emitAgentActivity } from "#agent/runtime/activity.js";
import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";
import { createInitialWorkLoop } from "#agent/shared/work-loop/types.js";
import { finalizeSubtasksOnCompletion } from "../advance-subtask/subtasks.js";
import {
  buildContentPolicyFallbackMessage,
  handleContentPolicyOrThrow,
  isContentPolicyError,
} from "#agent/llm/node-fallback.js";
import { buildSynthesizeFallbackReply } from "./fallback.js";

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

  try {
    let streamedText = "";
    const response = await streamChat(
      llm,
      [new SystemMessage(system), ...prepareSynthesizeMessagesForLlm(state)],
      config,
      {
        additionalKwargs: turnMeta,
        pushToGraph: false,
        onTextDelta: (delta) => {
          streamedText += delta;
          emitAgentActivity({ type: "reply_delta", delta });
        },
      },
    );

    let text = messageContentToText(response.content).trim();
    if (!text) {
      text = streamedText.trim() || buildSynthesizeFallbackReply(workLoop, state.mode);
      if (!streamedText.trim()) {
        emitAgentActivity({ type: "reply_delta", delta: text });
      }
    }

    const message =
      text === messageContentToText(response.content).trim()
        ? response
        : new AIMessage({
            id: response.id,
            content: text,
            additional_kwargs: {
              ...response.additional_kwargs,
              ...turnMeta,
            },
          });

    return { messages: [message], workLoop };
  } catch (error) {
    if (isContentPolicyError(error)) {
      const fallback = buildContentPolicyFallbackMessage(error, turnMeta);
      const fallbackText =
        typeof fallback.content === "string" ? fallback.content : "";
      emitAgentActivity({
        type: "reply_delta",
        delta: fallbackText,
      });
      return { messages: [fallback] };
    }
    handleContentPolicyOrThrow(error, "synthesize");
  }
}
