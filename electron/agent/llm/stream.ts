/**
 * Chat 模型流式调用（LangGraph pushMessage）。
 */
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
} from "@langchain/core/messages";
import type { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { pushMessage } from "@langchain/langgraph";
import { nanoid } from "nanoid";

import { sanitizeMessagesForTextChat } from "#agent/messages/prepare.js";
import { LLM_TIMEOUT_MS, withLlmRetry } from "./timeout.js";

/** 关闭 LLM callback 自动 messages 流，改由 pushMessage 推增量 chunk。 */
const NOSTREAM_TAGS = ["nostream"] as const;

type ChatModel = Runnable<BaseMessage[], AIMessageChunk, RunnableConfig>;

type StreamChatOptions = {
  /** 固定流式消息 id（与节点返回的 AIMessage 对齐） */
  messageId?: string;
  /** 合并进每个 chunk 与最终 AIMessage 的 additional_kwargs */
  additionalKwargs?: Record<string, unknown>;
  /** 文本增量回调（用于 synthesize 回复流式展示） */
  onTextDelta?: (delta: string) => void;
};

function withNoStreamTags(config: RunnableConfig): RunnableConfig {
  const tags = [...new Set([...(config.tags ?? []), ...NOSTREAM_TAGS])];
  return { ...config, tags };
}

function hasStreamDelta(chunk: AIMessageChunk): boolean {
  if (typeof chunk.content === "string" && chunk.content.length > 0) {
    return true;
  }
  if (Array.isArray(chunk.content) && chunk.content.length > 0) {
    return true;
  }
  if (chunk.tool_call_chunks?.length) return true;
  if (chunk.tool_calls?.length) return true;
  if (chunk.invalid_tool_calls?.length) return true;
  return false;
}

function chunkToAIMessage(
  chunk: AIMessageChunk,
  messageId: string,
  additionalKwargs?: Record<string, unknown>,
): AIMessage {
  return new AIMessage({
    id: messageId,
    content: chunk.content,
    tool_calls: chunk.tool_calls,
    invalid_tool_calls: chunk.invalid_tool_calls,
    additional_kwargs: {
      ...chunk.additional_kwargs,
      ...additionalKwargs,
    },
    usage_metadata: chunk.usage_metadata,
    response_metadata: chunk.response_metadata,
  });
}

/** 流式调用 Chat 模型，逐增量 chunk pushMessage。用于 llm-chat 子图节点。 */
export async function streamChat(
  model: ChatModel,
  input: BaseMessage[],
  config: RunnableConfig,
  options?: StreamChatOptions,
): Promise<AIMessage> {
  const presetMessageId = options?.messageId;
  const additionalKwargs = options?.additionalKwargs;
  const messages = sanitizeMessagesForTextChat(input);
  const attemptState = { hadStreamDelta: false };

  return withLlmRetry({
    parentSignal: config.signal,
    timeoutMs: LLM_TIMEOUT_MS.chat,
    canRetry: () => !attemptState.hadStreamDelta,
    run: async (signal) => {
      attemptState.hadStreamDelta = false;
      const streamConfig = { ...withNoStreamTags(config), signal };
      const stream = await model.stream(messages, streamConfig);
      let accumulated: AIMessageChunk | undefined;
      let messageId: string | undefined = presetMessageId;

      for await (const chunk of stream) {
        accumulated = accumulated ? accumulated.concat(chunk) : chunk;
        const id = presetMessageId ?? accumulated.id ?? messageId ?? (messageId = nanoid());
        messageId = id;
        if (hasStreamDelta(chunk)) {
          attemptState.hadStreamDelta = true;
          if (options?.onTextDelta && typeof chunk.content === "string" && chunk.content) {
            options.onTextDelta(chunk.content);
          }
          pushMessage(chunkToAIMessage(chunk, id, additionalKwargs), config);
        }
      }

      if (!accumulated) {
        throw new Error("Chat stream returned no chunks");
      }

      const finalId = presetMessageId ?? accumulated.id ?? messageId ?? nanoid();
      return chunkToAIMessage(accumulated, finalId, additionalKwargs);
    },
  });
}
