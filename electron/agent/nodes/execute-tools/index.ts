import { ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";
import { createWorkspaceTools } from "#agent/tools/workspace.js";
import {
  validateToolCall,
} from "#agent/shared/work-loop/tool-gate.js";
import { resolveToolName } from "#agent/shared/tooling.js";
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
    rawName: string;
    name: string;
    content: string;
    id: string;
    args: Record<string, unknown>;
  }> = [];

  for (const call of toolCalls) {
    const rawName = call.name;
    const args = (call.args ?? {}) as Record<string, unknown>;
    const toolCallId = call.id ?? rawName;

    const resolved = resolveToolName(rawName);
    if (resolved.kind === "rejected") {
      toolResults.push({
        rawName,
        name: rawName,
        id: toolCallId,
        args,
        content: errorObservation(
          rawName,
          resolved.code,
          resolved.message,
          resolved.hint,
        ),
      });
      continue;
    }

    const name = resolved.name;
    const gate = validateToolCall(name, args, workLoop, state.mode);

    if (!gate.allowed) {
      toolResults.push({
        rawName,
        name,
        id: toolCallId,
        args,
        content: errorObservation(rawName, gate.code, gate.message),
      });
      continue;
    }

    const tool = toolMap.get(name);
    if (!tool) {
      toolResults.push({
        rawName,
        name: rawName,
        id: toolCallId,
        args,
        content: errorObservation(rawName, "UNKNOWN_TOOL", `未知工具 ${rawName}`),
      });
      continue;
    }

    try {
      const content = await tool.invoke(args);
      toolResults.push({
        rawName,
        name,
        id: toolCallId,
        args,
        content: typeof content === "string" ? content : JSON.stringify(content),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toolResults.push({
        rawName,
        name,
        id: toolCallId,
        args,
        content: errorObservation(rawName, "TOOL_ERROR", message),
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
        name: r.rawName,
      }),
  );

  return { messages, workLoop: nextLoop };
}
