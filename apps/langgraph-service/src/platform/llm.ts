import { ChatOpenAI } from "@langchain/openai";

import { getChatModel, getLlmApiKey, getLlmBaseUrl } from "./env.js";

export function createChatModel(options?: {
  temperature?: number;
  maxTokens?: number;
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
  });
}
