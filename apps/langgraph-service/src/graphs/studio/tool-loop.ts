import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";

import { loadMcpTools, type McpToolProfile } from "../../mcp/client.js";
import { createChatModel } from "../../platform/llm.js";

const CHANGED_FILE_PATTERN =
  /(?:已编辑|已写入|已创建|已删除)\s+([^\s\n]+)/g;

export function collectChangedFiles(toolOutput: string): string[] {
  const matches = [...toolOutput.matchAll(CHANGED_FILE_PATTERN)];
  return [...new Set(matches.map((match) => match[1]!))];
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string" ? part : "text" in part ? String(part.text) : "",
      )
      .join("");
  }
  return String(content ?? "");
}

/** ReAct agent: each tool round is agent + tools nodes, plus one final answer. */
function agentRecursionLimit(maxToolRounds: number): number {
  return maxToolRounds * 2 + 3;
}

export async function runToolLoop(input: {
  workPath: string;
  profile: McpToolProfile;
  systemPrompt: string;
  userPrompt: string;
  maxToolRounds: number;
  abortSignal?: AbortSignal;
}): Promise<{ text: string; changedFiles: string[] }> {
  const model = createChatModel({ disableThinking: true }).withConfig({
    tags: ["nostream"],
  });
  const tools = await loadMcpTools(input.profile, input.workPath);
  const agent = createReactAgent({
    llm: model,
    tools,
    messageModifier: input.systemPrompt,
  });

  const result = await agent.invoke(
    { messages: [new HumanMessage(input.userPrompt)] },
    {
      recursionLimit: agentRecursionLimit(input.maxToolRounds),
      signal: input.abortSignal,
      configurable: { workPath: input.workPath },
    },
  );

  const allText = result.messages
    .map((message) => extractMessageText(message.content))
    .join("\n");

  const last = result.messages[result.messages.length - 1];
  const text = extractMessageText(last?.content);

  return {
    text: text || allText,
    changedFiles: collectChangedFiles(allText),
  };
}
