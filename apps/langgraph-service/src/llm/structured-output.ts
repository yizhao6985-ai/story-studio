import { ZodError, type z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Runnable } from "@langchain/core/runnables";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";

import { withThinkingDisabled } from "../platform/llm.js";

const INTERNAL_STREAM_TAGS = ["nostream"];

const DEFAULT_SYSTEM_HINT =
  "你是 Story Studio 结构化输出助手。严格按 schema 输出，不要额外解释。";

export type StructuredOutputOptions = {
  /** Function calling 工具名，便于 LangSmith 追踪 */
  name?: string;
};

function buildMessages(
  systemHint: string,
  prompt: string,
): [SystemMessage, HumanMessage] {
  return [new SystemMessage(systemHint), new HumanMessage(prompt)];
}

async function invokeAndNormalize<TSchema extends z.ZodTypeAny>(
  structuredModel: Runnable<BaseLanguageModelInput, unknown>,
  messages: [SystemMessage, HumanMessage],
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const raw = await structuredModel.invoke(messages);
  return schema.parse(raw);
}

export async function generateStructuredOutput<TSchema extends z.ZodTypeAny>(
  model: BaseChatModel,
  prompt: string,
  schema: TSchema,
  systemHint?: string,
  options?: StructuredOutputOptions,
): Promise<z.infer<TSchema>> {
  const system = systemHint ?? DEFAULT_SYSTEM_HINT;
  // DeepSeek thinking 模式不支持强制 tool_choice，结构化输出前关闭 thinking。
  const internalModel = withThinkingDisabled(model);
  // DeepSeek 等非 GPT 模型会被 LangChain 默认推断为 jsonSchema（response_format），
  // 但 OpenAI 兼容代理通常只支持 function calling，故显式指定工具模式。
  const structuredModel = internalModel
    .withStructuredOutput(schema, {
      name: options?.name ?? "structured_output",
      method: "functionCalling",
    })
    .withConfig({ tags: INTERNAL_STREAM_TAGS });

  const messages = buildMessages(system, prompt);

  try {
    return await invokeAndNormalize(structuredModel, messages, schema);
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;

    const retryMessages = buildMessages(
      system,
      `${prompt}\n\n上次输出未通过校验：${JSON.stringify(error.errors)}\n请修正缺失或类型错误的字段后重新输出。`,
    );

    return invokeAndNormalize(structuredModel, retryMessages, schema);
  }
}
