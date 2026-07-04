/**
 * 结构化输出调用（同步 invoke）。
 * 内部 LLM 默认带 nostream tag，避免 messages-tuple 泄漏到前端；
 * 并强制 streaming: false，走一次性 completion 而非流式读 chunk。
 */
import type { BaseMessage } from "@langchain/core/messages";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { z } from "zod";

import { sanitizeMessagesForTextChat } from "#agent/messages/prepare.js";
import { getSelectedChatModel } from "../../settings/store.js";
import {
  getDashScopeChatKwargs,
  resolveDashScopeChatFamily,
} from "#agent/llm/chat-config.js";
import { LLM_TIMEOUT_MS, withLlmRetry } from "./timeout.js";

type StructuredOutputMethod = "functionCalling" | "jsonMode";

type StructuredInvokeOptions = {
  name?: string;
  method?: StructuredOutputMethod;
  timeoutMs?: number;
  /** 超时重试次数，默认 2；传 1 表示不重试 */
  maxAttempts?: number;
};

type ChatModelWithKwargs = BaseChatModel & {
  modelKwargs?: Record<string, unknown>;
  /** ChatOpenAI：结构化 invoke 走非流式，避免 _streamResponseChunks 与 AbortSignal 交织 */
  streaming?: boolean;
};

type ChatModelWithName = BaseChatModel & {
  model?: string;
  modelName?: string;
};

/** LangGraph StreamMessagesHandler 同时识别这两个 tag。 */
const NOSTREAM_TAGS = ["nostream"] as const;

/** 合并父级 config，并标记为不向 messages 通道推流。 */
function isolatedStructuredConfig(
  config?: RunnableConfig,
): RunnableConfig {
  const tags = [...new Set([...(config?.tags ?? []), ...NOSTREAM_TAGS])];
  return { ...config, tags };
}

/** 关闭 thinking；结构化 invoke 关闭 streaming。 */
function forStructuredInvoke(llm: BaseChatModel): BaseChatModel {
  const chat = llm as ChatModelWithKwargs;
  if ("streaming" in chat) {
    chat.streaming = false;
  }
  const named = llm as ChatModelWithName;
  const modelName =
    typeof named.model === "string"
      ? named.model
      : typeof named.modelName === "string"
        ? named.modelName
        : getSelectedChatModel();
  const kwargs = getDashScopeChatKwargs(
    resolveDashScopeChatFamily(modelName),
    "structured",
  );
  if (chat.modelKwargs !== undefined) {
    chat.modelKwargs = {
      ...chat.modelKwargs,
      ...kwargs,
    };
  }
  return llm;
}

function sanitizeStructuredInput(
  input: BaseLanguageModelInput,
): BaseLanguageModelInput {
  if (!Array.isArray(input)) return input;
  return sanitizeMessagesForTextChat(input as BaseMessage[]);
}

/** 同步结构化输出，返回 Zod 校验后的对象。 */
export async function invokeStructured<T extends Record<string, unknown>>(
  llm: BaseChatModel,
  schema: z.ZodType<T>,
  input: BaseLanguageModelInput,
  options?: StructuredInvokeOptions,
  config?: RunnableConfig,
): Promise<T> {
  const baseConfig = isolatedStructuredConfig(config);
  const timeoutMs = options?.timeoutMs ?? LLM_TIMEOUT_MS.structured;
  const sanitizedInput = sanitizeStructuredInput(input);
  const structured = forStructuredInvoke(llm).withStructuredOutput(schema, {
    name: options?.name ?? "structured_output",
    method: options?.method ?? "functionCalling",
    includeRaw: true,
  });

  return withLlmRetry({
    parentSignal: config?.signal,
    timeoutMs,
    maxAttempts: options?.maxAttempts,
    run: async (signal) => {
      const result = (await structured.invoke(
        sanitizedInput,
        { ...baseConfig, signal },
      )) as { parsed: T | null | undefined; raw: BaseMessage };
      if (result.parsed == null) {
        throw new Error("STRUCTURED_OUTPUT_PARSE_FAILED");
      }
      return result.parsed;
    },
  });
}

