import { AIMessage, isHumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

import { getRelevantContext } from "../../../context/service.js";
import { requireWorkPathFromConfig } from "../../../mcp/work-path.js";
import type { StudioGraphState } from "../state.js";
import { getModeFromConfig } from "../config.js";

export function getLastHumanMessageText(
  messages: StudioGraphState["messages"],
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || !isHumanMessage(message)) continue;
    const content = message.content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part) =>
          typeof part === "string" ? part : "text" in part ? String(part.text) : "",
        )
        .join("")
        .trim();
    }
  }
  return "";
}

export async function prepareTurnNode(
  state: StudioGraphState,
  config: RunnableConfig,
): Promise<Partial<StudioGraphState>> {
  const userMessage = getLastHumanMessageText(state.messages);
  if (!userMessage) {
    throw new Error("USER_MESSAGE_MISSING");
  }

  const workPath = requireWorkPathFromConfig(config);
  const projectContext = await getRelevantContext({
    workPath,
    query: userMessage,
  });

  return {
    mode: getModeFromConfig(config),
    userMessage,
    projectContext,
    intent: undefined,
    taskQueue: [],
    taskIndex: 0,
    taskResults: [],
    changedFiles: [],
  };
}

export async function clarifyNode(state: StudioGraphState): Promise<Partial<StudioGraphState>> {
  const question =
    state.intent?.clarificationQuestion?.trim() ||
    "能否再具体说明一下你的需求？";

  return {
    messages: [new AIMessage(question)],
  };
}
