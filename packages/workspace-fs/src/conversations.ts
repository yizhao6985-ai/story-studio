import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ConversationManifest } from "@story-studio/shared/story";
import { workConversationsDir } from "@story-studio/shared/paths";

import { getUserDataRoot } from "./config.ts";

function conversationsIndexPath(workPath: string): string {
  return join(workConversationsDir(getUserDataRoot(), workPath), "index.json");
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
  await mkdir(workConversationsDir(getUserDataRoot(), workPath), {
    recursive: true,
  });
  await writeFile(indexPath, JSON.stringify(conversations, null, 2), "utf8");
}

export async function updateConversationTitle(
  workPath: string,
  conversationId: string,
  title: string,
): Promise<ConversationManifest | null> {
  const trimmed = title.trim();
  if (!trimmed) return null;

  const conversations = await readConversationIndex(workPath);
  const index = conversations.findIndex((item) => item.id === conversationId);
  if (index === -1) return null;

  const updated: ConversationManifest = {
    ...conversations[index]!,
    title: trimmed,
    updatedAt: new Date().toISOString(),
  };
  conversations[index] = updated;
  await writeConversationIndex(workPath, conversations);
  return updated;
}
