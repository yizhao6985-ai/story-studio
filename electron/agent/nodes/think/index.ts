import { SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

import { getAgentEnv } from "#agent/llm/env.js";
import { streamChat } from "#agent/llm/stream.js";
import { createChatModel } from "#agent/llm/chat-model.js";
import { prepareChatMessagesForLlm } from "#agent/messages/prepare.js";
import { buildThinkSystemPrompt } from "./prompt.js";
import { buildInternalThinkKwargs } from "#agent/messages/turn-meta.js";
import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";
import { createInitialWorkLoop } from "#agent/shared/work-loop/types.js";
import { createWorkspaceTools } from "#agent/tools/workspace.js";

import { filterToolsByMode } from "../utils.js";

export async function thinkNode(
  state: AgentStateType,
  config: RunnableConfig,
): Promise<AgentStatePatch> {
  const workLoop = state.workLoop ?? createInitialWorkLoop();
  const system = buildThinkSystemPrompt(state.mode, workLoop);

  const allTools = state.workPath ? createWorkspaceTools(state.workPath) : [];
  const tools = filterToolsByMode(allTools, state.mode);

  const llm = createChatModel({ temperature: getAgentEnv().llmTemperature }).bindTools(
    tools.length ? tools : [],
  );

  const response = await streamChat(
    llm,
    [new SystemMessage(system), ...prepareChatMessagesForLlm(state)],
    config,
    {
      additionalKwargs: buildInternalThinkKwargs(),
    },
  );

  return { messages: [response] };
}
