import { RequestContext } from "@mastra/core/request-context";

import type { AgentActivityEvent } from "@story-studio/shared/activity";
import type { AgentMode } from "@story-studio/shared/story";
import { DEFAULT_DEEPSEEK_CHAT_MODEL } from "@story-studio/shared/mastra-headers";
import {
  AGENT_RUN_TIMEOUT_ABORT,
  AGENT_RUN_TIMEOUT_MS,
  AGENT_USER_CANCEL_ABORT,
  classifyLlmError,
  isLlmLayerError,
  isUserCancelError,
  toAgentRunError,
} from "@story-studio/shared/llm-errors";
import { updateConversationTitle } from "@story-studio/workspace-fs";
import { ensureConversationThread } from "../platform/mastra/lifecycle.js";
import { getStudioMastra } from "../../mastra/registry.js";
import {
  createStreamSink,
  handleStreamChunk,
} from "./stream.js";
import type {
  AgentRunResult,
  ChatMessage,
  ContextUsageResult,
} from "@story-studio/shared/agent-types";

let activeRunAbort: AbortController | null = null;
let activeRunPromise: Promise<AgentRunResult> | null = null;

export type AgentRunInput = {
  workPath: string;
  conversationId: string;
  message: string;
  mode: AgentMode;
  humanMessageKwargs?: Record<string, unknown>;
  manageActivityEmitter?: boolean;
  onActivity?: (event: AgentActivityEvent) => void;
  requestContext?: RequestContext;
};

export type AgentContextUsageInput = {
  workPath: string;
  conversationId: string;
  mode: AgentMode;
  draftMessage?: string;
  requestContext?: RequestContext;
};

export type { ChatMessage, ContextUsageResult } from "@story-studio/shared/agent-types";

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

export async function loadConversationMessages(input: {
  workPath: string;
  conversationId: string;
}): Promise<ChatMessage[]> {
  await ensureConversationThread(input.workPath, input.conversationId);
  const mastra = getStudioMastra();
  const memory = await mastra.getAgent("storySupervisor").getMemory();
  if (!memory) return [];

  const thread = await memory.getThreadById({
    threadId: input.conversationId,
  });
  if (!thread) return [];

  let messages: Awaited<ReturnType<typeof memory.recall>>["messages"] = [];
  try {
    ({ messages } = await memory.recall({
      threadId: input.conversationId,
      resourceId: input.workPath,
      perPage: false,
    }));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("No thread found")
    ) {
      return [];
    }
    throw error;
  }

  const out: ChatMessage[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      const text = messageText(message.content).trim();
      if (text) out.push({ role: "user", text });
    } else if (message.role === "assistant") {
      const text = messageText(message.content).trim();
      if (text) out.push({ role: "assistant", text });
    }
  }
  return out;
}

export async function getAgentContextUsage(
  input: AgentContextUsageInput,
): Promise<ContextUsageResult> {
  const mastra = getStudioMastra();
  const memory = await mastra.getAgent("storySupervisor").getMemory();

  let usedTokens = 0;
  if (memory) {
    const thread = await memory.getThreadById({
      threadId: input.conversationId,
    });
    if (thread) {
      try {
        const recalled = await memory.recall({
          threadId: input.conversationId,
          resourceId: input.workPath,
          perPage: 20,
        });
        usedTokens = recalled.usage?.tokens ?? 0;
      } catch {
        usedTokens = 0;
      }
    }
    if (input.draftMessage?.trim()) {
      usedTokens += input.draftMessage.trim().length / 3;
    }
  }

  let modelLabel = DEFAULT_DEEPSEEK_CHAT_MODEL;
  try {
    const model = await mastra
      .getAgent("storySupervisor")
      .getModel({ requestContext: input.requestContext });
    modelLabel = model.modelId;
  } catch {
    // API Key 未配置时仍返回上下文用量，模型名用默认值。
  }
  const maxTokens = 128_000;
  return {
    usedTokens: Math.round(usedTokens),
    maxTokens,
    percent: Math.min(100, Math.round((usedTokens / maxTokens) * 100)),
    modelLabel,
  };
}

export function cancelLocalAgent(): void {
  activeRunAbort?.abort(AGENT_USER_CANCEL_ABORT);
}

export async function waitForActiveAgentRun(
  timeoutMs: number,
): Promise<void> {
  const run = activeRunPromise;
  if (!run) return;

  await Promise.race([
    run.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

const DISALLOWED_TITLES = new Set([
  "新对话",
  "对话",
  "未命名",
  "未命名对话",
  "新会话",
  "聊天",
]);

function normalizeGeneratedTitle(raw: string): string {
  return raw.trim().replace(/^["「『]|["」』]$/g, "").slice(0, 24);
}

function isUsableConversationTitle(title: string): boolean {
  const normalized = normalizeGeneratedTitle(title);
  if (normalized.length < 2) return false;
  if (DISALLOWED_TITLES.has(normalized)) return false;
  return true;
}

export async function syncConversationTitleFromMemory(input: {
  workPath: string;
  conversationId: string;
}): Promise<void> {
  const mastra = getStudioMastra();
  const memory = await mastra.getAgent("storySupervisor").getMemory();
  if (!memory) return;

  // Memory.generateTitle 在回复后异步运行，短暂轮询等待标题写入。
  for (let attempt = 0; attempt < 6; attempt++) {
    const thread = await memory.getThreadById({
      threadId: input.conversationId,
    });
    const title = thread?.title ? normalizeGeneratedTitle(thread.title) : "";
    if (title && isUsableConversationTitle(title)) {
      await updateConversationTitle(
        input.workPath,
        input.conversationId,
        title,
      );
      return;
    }
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

function buildRunRequestContext(input: AgentRunInput): RequestContext {
  const requestContext = input.requestContext ?? new RequestContext();
  requestContext.set("mode", input.mode);
  requestContext.set("workPath", input.workPath);
  return requestContext;
}

async function runLocalAgentInner(
  input: AgentRunInput,
): Promise<AgentRunResult> {
  activeRunAbort?.abort(AGENT_USER_CANCEL_ABORT);
  activeRunAbort = new AbortController();
  const runAbort = activeRunAbort;
  const runTimeoutId = setTimeout(() => {
    runAbort.abort(AGENT_RUN_TIMEOUT_ABORT);
  }, AGENT_RUN_TIMEOUT_MS);

  const mastra = getStudioMastra();
  const supervisor = mastra.getAgent("storySupervisor");
  const requestContext = buildRunRequestContext(input);

  const sink = createStreamSink(input.onActivity);
  if (input.manageActivityEmitter !== false) {
    sink.emit({ type: "status", status: "thinking" });
  }

  const state = { reply: "" };

  try {
    const output = await supervisor.stream(input.message, {
      memory: {
        thread: input.conversationId,
        resource: input.workPath,
      },
      requestContext,
      abortSignal: runAbort.signal,
      maxSteps: input.mode === "ask" ? 16 : 24,
    });

    for await (const chunk of output.fullStream) {
      handleStreamChunk(chunk, sink, state);
    }

    const streamError = output.error;
    if (streamError) {
      throw streamError;
    }

    const reply = (await output.text).trim() || state.reply.trim() || "（无回复）";
    sink.emit({ type: "done", reply });

    try {
      await syncConversationTitleFromMemory({
        workPath: input.workPath,
        conversationId: input.conversationId,
      });
    } catch {
      // 标题同步失败时保持「新对话」，不阻塞主流程
    }

    return {
      reply,
      artifactPaths: [...sink.artifactPaths],
    };
  } catch (error) {
    if (isUserCancelError(error)) throw error;
    const classified = classifyLlmError(error);
    if (isLlmLayerError(classified, error)) {
      const agentError = toAgentRunError(error);
      sink.emit({
        type: "error",
        source: "llm",
        kind: agentError.kind,
        message: agentError.userMessage,
        suggestion: agentError.suggestion,
        detail: agentError.raw,
      });
    }
    throw toAgentRunError(error);
  } finally {
    clearTimeout(runTimeoutId);
    activeRunAbort = null;
  }
}

export async function runLocalAgent(
  input: AgentRunInput,
): Promise<AgentRunResult> {
  const run = runLocalAgentInner(input);
  activeRunPromise = run;
  try {
    return await run;
  } finally {
    if (activeRunPromise === run) {
      activeRunPromise = null;
    }
  }
}
