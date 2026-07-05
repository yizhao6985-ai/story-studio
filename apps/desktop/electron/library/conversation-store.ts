import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";

import type { ConversationManifest } from "@story-studio/shared/story";
import {
  normalizeWorkPath,
  workConversationsDir,
  workUserDataDir,
} from "./work-data-dir.js";

const DEFAULT_CONVERSATION_TITLE = "新对话";

function conversationsIndexPath(workPath: string): string {
  return join(workConversationsDir(workPath), "index.json");
}

async function readConversationIndex(
  workPath: string,
): Promise<ConversationManifest[]> {
  try {
    const raw = await readFile(conversationsIndexPath(workPath), "utf8");
    const parsed = JSON.parse(raw) as ConversationManifest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeConversationIndex(
  workPath: string,
  conversations: ConversationManifest[],
): Promise<void> {
  const indexPath = conversationsIndexPath(workPath);
  await mkdir(workConversationsDir(workPath), { recursive: true });
  await writeFile(indexPath, JSON.stringify(conversations, null, 2), "utf8");
}

export async function prepareConversationStore(workPath: string): Promise<void> {
  const dir = workUserDataDir(workPath);
  await mkdir(dir, { recursive: true });
  await mkdir(workConversationsDir(workPath), { recursive: true });
  await writeFile(
    join(dir, "work-path.json"),
    JSON.stringify({ workPath: normalizeWorkPath(workPath) }, null, 2),
    "utf8",
  );
}

export async function listConversations(
  workPath: string,
): Promise<ConversationManifest[]> {
  const conversations = await readConversationIndex(workPath);
  return conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function createConversation(
  workPath: string,
  title?: string,
): Promise<ConversationManifest> {
  await prepareConversationStore(workPath);
  const existing = await listConversations(workPath);
  const now = new Date().toISOString();
  const conversation: ConversationManifest = {
    id: nanoid(10),
    title: title?.trim() || DEFAULT_CONVERSATION_TITLE,
    createdAt: now,
    updatedAt: now,
  };

  await writeConversationIndex(workPath, [conversation, ...existing]);
  return conversation;
}

export async function touchConversation(
  workPath: string,
  conversationId: string,
): Promise<ConversationManifest | null> {
  const conversations = await listConversations(workPath);
  const index = conversations.findIndex((item) => item.id === conversationId);
  if (index === -1) return null;

  const updated: ConversationManifest = {
    ...conversations[index]!,
    updatedAt: new Date().toISOString(),
  };
  conversations[index] = updated;
  await writeConversationIndex(workPath, conversations);
  return updated;
}

export async function deleteConversation(
  workPath: string,
  conversationId: string,
): Promise<boolean> {
  const conversations = await readConversationIndex(workPath);
  const index = conversations.findIndex((item) => item.id === conversationId);
  if (index === -1) return false;

  await writeConversationIndex(
    workPath,
    conversations.filter((item) => item.id !== conversationId),
  );
  return true;
}
