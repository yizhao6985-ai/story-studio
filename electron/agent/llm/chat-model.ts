/**
 * 百炼 DashScope 文本 Chat（OpenAI 兼容）。
 */
import { getAgentEnv } from "#agent/llm/env.js";
import { getSelectedChatModel } from "../../settings/store.js";
import {
  getDashScopeChatKwargs,
  resolveDashScopeChatFamily,
} from "./chat-config.js";
import {
  createOpenAiCompatibleChatModel,
  type OpenAiCompatibleChatModelOptions,
} from "./openai-compatible.js";

function assertLlmApiKey(): void {
  if (!getAgentEnv().apiKey) {
    throw new Error("LLM_API_KEY_MISSING");
  }
}

/** 对话、结构化 work 等文本任务（计划/验收/建议等，默认较短输出）。 */
export function createChatModel(options?: OpenAiCompatibleChatModelOptions) {
  assertLlmApiKey();
  const env = getAgentEnv();

  const model = getSelectedChatModel();
  const family = resolveDashScopeChatFamily(model);

  return createOpenAiCompatibleChatModel(
    {
      apiKey: env.apiKey,
      baseURL: env.baseUrl,
      model,
      temperature: env.llmTemperature,
      streaming: true,
      maxTokens: env.llmMaxTokens,
      modelKwargs: getDashScopeChatKwargs(family, "stream"),
    },
    options,
  );
}
