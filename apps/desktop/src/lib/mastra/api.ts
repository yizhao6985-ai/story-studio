import type { ContextUsageResult } from "@story-studio/shared/agent-types";
import type { AgentMode } from "@story-studio/shared/story";

import { getMastraApiBase } from "./connection";
import type { StudioUIMessage } from "./studio-message";

async function mastraFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = await getMastraApiBase();
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `MASTRA_${response.status}`);
  }
  return response;
}

export async function loadChatMessages(input: {
  workPath: string;
  conversationId: string;
}): Promise<StudioUIMessage[]> {
  const params = new URLSearchParams({
    workPath: input.workPath,
    conversationId: input.conversationId,
  });
  const response = await mastraFetch(
    `/studio/chat/messages?${params.toString()}`,
  );
  const data = (await response.json()) as { messages: StudioUIMessage[] };
  return data.messages;
}

export async function getContextUsage(input: {
  workPath: string;
  conversationId: string;
  mode: AgentMode;
  draftMessage?: string;
}): Promise<ContextUsageResult> {
  const params = new URLSearchParams({
    workPath: input.workPath,
    conversationId: input.conversationId,
    mode: input.mode,
  });
  if (input.draftMessage?.trim()) {
    params.set("draftMessage", input.draftMessage.trim());
  }
  const response = await mastraFetch(
    `/studio/context-usage?${params.toString()}`,
  );
  return response.json() as Promise<ContextUsageResult>;
}

export async function ensureThread(input: {
  workPath: string;
  conversationId: string;
  title?: string;
}): Promise<void> {
  await mastraFetch("/studio/threads/ensure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteThread(input: {
  workPath: string;
  threadId: string;
}): Promise<void> {
  const params = new URLSearchParams({ workPath: input.workPath });
  await mastraFetch(
    `/studio/threads/${encodeURIComponent(input.threadId)}?${params.toString()}`,
    { method: "DELETE" },
  );
}

export async function evictWorkAgent(workPath: string): Promise<void> {
  await mastraFetch("/studio/works/evict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workPath }),
  });
}

export async function buildChatApiUrl(path: string): Promise<string> {
  const base = await getMastraApiBase();
  return `${base}${path}`;
}
