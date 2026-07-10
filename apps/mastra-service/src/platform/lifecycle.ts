import { getStudioMastra } from "../mastra/registry.js";

export async function ensureConversationThread(
  workPath: string,
  conversationId: string,
  title?: string,
): Promise<void> {
  const mastra = getStudioMastra();
  const memory = await mastra.getAgent("storySupervisor").getMemory();
  if (!memory) return;

  const existing = await memory.getThreadById({
    threadId: conversationId,
  });
  if (existing) return;

  await memory.createThread({
    threadId: conversationId,
    resourceId: workPath,
    title: title?.trim() || "新对话",
  });
}

export async function deleteWorkThread(
  workPath: string,
  threadId: string,
): Promise<void> {
  const mastra = getStudioMastra();
  const memory = await mastra.getAgent("storySupervisor").getMemory();
  if (memory) {
    await memory.deleteThread(threadId);
  }
}

export async function releaseWorkAgent(_workPath: string): Promise<void> {
  // 单实例模式下无需释放
}
