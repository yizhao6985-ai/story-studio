import type { AgentMode } from "@/hooks/types";
import type { ConversationManifest } from "@/lib/story";

import { discoverLangGraphApiUrl } from "./config";

import { Client } from "@langchain/langgraph-sdk";

let clientPromise: Promise<Client> | null = null;

export type ThreadMetadata = {
  workPath: string;
  title: string;
  mode: AgentMode;
};

export async function getLangGraphClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = discoverLangGraphApiUrl().then(
      (apiUrl) => new Client({ apiUrl }),
    );
  }
  return clientPromise;
}

function threadToManifest(thread: {
  thread_id: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}): ConversationManifest {
  const now = new Date().toISOString();
  return {
    id: thread.thread_id,
    title: (thread.metadata?.title as string | undefined)?.trim() || "新对话",
    createdAt: thread.created_at ?? now,
    updatedAt: thread.updated_at ?? now,
  };
}

export function parseThreadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): ThreadMetadata | null {
  const workPath = metadata?.workPath;
  if (typeof workPath !== "string" || !workPath.trim()) return null;
  const mode = metadata?.mode === "ask" ? "ask" : "normal";
  const title =
    (typeof metadata?.title === "string" && metadata.title.trim()) ||
    "新对话";
  return { workPath: workPath.trim(), title, mode };
}

export async function getThreadMetadata(
  threadId: string,
): Promise<ThreadMetadata | null> {
  const client = await getLangGraphClient();
  const thread = await client.threads.get(threadId);
  return parseThreadMetadata(thread.metadata);
}

export function deriveConversationTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "新对话";
  const slice = normalized.slice(0, 24);
  return normalized.length > 24 ? `${slice}…` : slice;
}

export async function listConversations(
  workPath: string,
): Promise<ConversationManifest[]> {
  const client = await getLangGraphClient();
  const threads = await client.threads.search({
    metadata: { workPath },
    sortBy: "updated_at",
    sortOrder: "desc",
    limit: 100,
  });
  return threads.map(threadToManifest);
}

export async function createConversation(
  workPath: string,
  mode: AgentMode,
  title = "新对话",
): Promise<ConversationManifest> {
  const client = await getLangGraphClient();
  const thread = await client.threads.create({
    metadata: { workPath, title, mode },
  });
  return threadToManifest(thread);
}

export async function updateConversationTitle(
  threadId: string,
  title: string,
): Promise<void> {
  const client = await getLangGraphClient();
  const thread = await client.threads.get(threadId);
  const metadata = { ...(thread.metadata ?? {}), title: title.trim() || "新对话" };
  await client.threads.update(threadId, { metadata });
}

export async function deleteConversation(threadId: string): Promise<void> {
  const client = await getLangGraphClient();
  await client.threads.delete(threadId);
}

export function resetLangGraphClient(): void {
  clientPromise = null;
}
