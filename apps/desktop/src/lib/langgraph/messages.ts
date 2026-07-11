import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

export type ChatDisplayMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  status?: "running" | "done";
};

function messageContentToText(content: unknown): string {
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

function summarizeToolArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const record = args as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.path === "string") parts.push(record.path);
  if (typeof record.query === "string") parts.push(`"${record.query}"`);
  if (typeof record.pattern === "string") parts.push(record.pattern);
  if (typeof record.goal === "string") {
    parts.push(record.goal.slice(0, 80));
  }
  return parts.join(" · ");
}

export function toDisplayMessages(messages: BaseMessage[]): ChatDisplayMessage[] {
  const result: ChatDisplayMessage[] = [];
  const pendingToolCalls = new Map<string, { name: string; args: unknown }>();

  for (const message of messages) {
    if (AIMessage.isInstance(message) && message.tool_calls?.length) {
      for (const call of message.tool_calls) {
        if (!call.id) continue;
        pendingToolCalls.set(call.id, {
          name: call.name,
          args: call.args,
        });
        const summary = summarizeToolArgs(call.args);
        result.push({
          id: call.id,
          role: "tool",
          toolName: call.name,
          content: summary || "执行中…",
          status: "running",
        });
      }
      continue;
    }

    if (ToolMessage.isInstance(message)) {
      const pending = message.tool_call_id
        ? pendingToolCalls.get(message.tool_call_id)
        : undefined;
      const content = messageContentToText(message.content).trim();
      result.push({
        id: message.id ?? message.tool_call_id ?? crypto.randomUUID(),
        role: "tool",
        toolName: pending?.name ?? "tool",
        content: content.slice(0, 500) || "完成",
        status: "done",
      });
      continue;
    }

    const content = messageContentToText(message.content).trim();
    if (!content) continue;

    if (HumanMessage.isInstance(message)) {
      result.push({
        id: message.id ?? crypto.randomUUID(),
        role: "user",
        content,
      });
      continue;
    }

    if (AIMessage.isInstance(message)) {
      result.push({
        id: message.id ?? crypto.randomUUID(),
        role: "assistant",
        content,
      });
    }
  }

  return result;
}

export function getMessageText(message: ChatDisplayMessage): string {
  return message.content;
}
