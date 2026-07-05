import { getChatModel, getLlmApiKey } from "../../agent/platform/llm/env.js";

const LLM_API_KEY_CONTEXT = "llm-api-key";
const CHAT_MODEL_CONTEXT = "chat-model";

/** 从环境变量注入 LLM 凭据到 requestContext。 */
export function createLlmContextMiddleware() {
  return async (
    context: {
      get: (key: "requestContext") => {
        set: (key: string, value: string) => void;
      };
    },
    next: () => Promise<void>,
  ) => {
    const requestContext = context.get("requestContext");
    requestContext.set(LLM_API_KEY_CONTEXT, getLlmApiKey());
    requestContext.set(CHAT_MODEL_CONTEXT, getChatModel());
    await next();
  };
}

export { LLM_API_KEY_CONTEXT, CHAT_MODEL_CONTEXT };
