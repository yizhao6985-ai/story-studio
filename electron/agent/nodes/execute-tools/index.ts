import { ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";
import { createWorkspaceTools } from "#agent/tools/workspace.js";
import {
  validateToolCall,
} from "#agent/shared/work-loop/tool-gate.js";
import { errorObservation } from "#agent/shared/work-loop/tool-error.js";

import { getLastAiMessage } from "../utils.js";
import { applyPostToolUpdates } from "./post-update.js";

export async function executeToolsNode(
  state: AgentStateType,
  _config: RunnableConfig,
): Promise<AgentStatePatch> {
  const workLoop = state.workLoop!;
  const lastAi = getLastAiMessage(state.messages ?? []);
  const toolCalls = lastAi?.tool_calls ?? [];

  if (!toolCalls.length || !state.workPath) {
    return {};
  }

  const allTools = createWorkspaceTools(state.workPath);
  const toolMap = new Map(allTools.map((t) => [t.name, t]));

  const toolResults: Array<{
    name: string;
    content: string;
    id: string;
    args: Record<string, unknown>;
  }> = [];

  for (const call of toolCalls) {
    const name = call.name;
    const args = (call.args ?? {}) as Record<string, unknown>;
    const gate = validateToolCall(name, args, workLoop, state.mode);
    const toolCallId = call.id ?? name;

    if (!gate.allowed) {
      toolResults.push({
        name,
        id: toolCallId,
        args,
        content: errorObservation(name, gate.code, gate.message),
      });
      continue;
    }

    const tool = toolMap.get(name);
    if (!tool) {
      toolResults.push({
        name,
        id: toolCallId,
        args,
        content: errorObservation(name, "UNKNOWN_TOOL", `未知工具 ${name}`),
      });
      continue;
    }

    try {
      const content = await tool.invoke(args);
      toolResults.push({
        name,
        id: toolCallId,
        args,
        content: typeof content === "string" ? content : JSON.stringify(content),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toolResults.push({
        name,
        id: toolCallId,
        args,
        content: errorObservation(name, "TOOL_ERROR", message),
      });
    }
  }

  const { workLoop: nextLoop, verifyMessages } = await applyPostToolUpdates(
    state.workPath,
    workLoop,
    state.mode,
    toolResults.map(({ name, content, args }) => ({ name, content, args })),
  );

  if (verifyMessages.length > 0) {
    for (let i = toolResults.length - 1; i >= 0; i--) {
      const entry = toolResults[i]!;
      if (
        entry.name === "write_workspace_file" ||
        entry.name === "patch_workspace_file" ||
        entry.name === "create_workspace_file"
      ) {
        entry.content = `${entry.content}\n\n${verifyMessages[0]!.content}`;
        break;
      }
    }
  }

  const messages = toolResults.map(
    (r) =>
      new ToolMessage({
        content: r.content,
        tool_call_id: r.id,
        name: r.name,
      }),
  );

  return { messages, workLoop: nextLoop };
}
