import type { z } from "zod";

/**
 * DeepSeek 不支持 response_format=json_schema，需用 prompt 注入 JSON 指令。
 * @see https://mastra.ai/docs/agents/structured-output#jsonpromptinjection
 */
export function deepSeekStructuredOutput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
) {
  return {
    schema,
    jsonPromptInjection: true as const,
  };
}
