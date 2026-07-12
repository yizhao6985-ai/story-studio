import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { getChatModel, getLlmApiKey, getLlmBaseUrl } from "./env.js";

/** DeepSeek V4 等模型默认开启 thinking，与强制 tool_choice 冲突，结构化输出需关闭。 */
export const THINKING_DISABLED_MODEL_KWARGS = {
  thinking: { type: "disabled" as const },
};

export function createChatModel(options?: {
  temperature?: number;
  maxTokens?: number;
  /** 关闭 DeepSeek thinking 模式（结构化输出、function calling、直接回复节点需要） */
  disableThinking?: boolean;
}): ChatOpenAI {
  const modelId = getChatModel();
  return new ChatOpenAI({
    model: modelId.includes("/") ? modelId.split("/").pop()! : modelId,
    apiKey: getLlmApiKey(),
    configuration: {
      baseURL: getLlmBaseUrl(),
    },
    temperature: options?.temperature ?? 0.3,
    maxTokens: options?.maxTokens,
    modelKwargs: options?.disableThinking
      ? THINKING_DISABLED_MODEL_KWARGS
      : undefined,
  });
}

/** 为已有 ChatOpenAI 实例关闭 thinking 模式，其他模型原样返回。 */
export function withThinkingDisabled(model: BaseChatModel): BaseChatModel {
  if (!(model instanceof ChatOpenAI)) return model;
  if (model.modelKwargs?.thinking?.type === "disabled") return model;

  return new ChatOpenAI({
    model: model.model,
    apiKey: model.apiKey,
    configuration: model.clientConfig,
    temperature: model.temperature,
    maxTokens: model.maxTokens,
    topP: model.topP,
    frequencyPenalty: model.frequencyPenalty,
    presencePenalty: model.presencePenalty,
    modelKwargs: {
      ...model.modelKwargs,
      ...THINKING_DISABLED_MODEL_KWARGS,
    },
  });
}
