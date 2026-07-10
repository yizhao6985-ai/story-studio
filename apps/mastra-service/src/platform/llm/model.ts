/**
 * DeepSeek via OpenAI-compatible API; 凭据来自环境变量（经 middleware 写入 requestContext）。
 */
import type { OpenAICompatibleConfig } from "@mastra/core/llm";
import type { RequestContext } from "@mastra/core/request-context";

import { DEFAULT_DEEPSEEK_CHAT_MODEL } from "@story-studio/shared/mastra-headers";
import {
  CHAT_MODEL_CONTEXT,
  LLM_API_KEY_CONTEXT,
} from "../../mastra/middleware/llm-context.js";

import { getLlmBaseUrl } from "./env.js";

type ModelResolverArgs = {
  requestContext?: RequestContext;
};

export function resolveStoryStudioModel({
  requestContext,
}: ModelResolverArgs = {}): OpenAICompatibleConfig {
  const apiKey = String(requestContext?.get(LLM_API_KEY_CONTEXT) ?? "").trim();
  if (!apiKey) {
    throw new Error("LLM_API_KEY_MISSING");
  }

  const rawModel =
    String(requestContext?.get(CHAT_MODEL_CONTEXT) ?? "").trim() ||
    DEFAULT_DEEPSEEK_CHAT_MODEL;
  const modelId = rawModel.includes("/")
    ? rawModel.split("/").pop()!
    : rawModel;

  return {
    providerId: "deepseek",
    modelId,
    url: getLlmBaseUrl(),
    apiKey,
  };
}
