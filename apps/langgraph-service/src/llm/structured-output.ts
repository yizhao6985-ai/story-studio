import type { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return text.slice(arrayStart, arrayEnd + 1);
  }

  return text.trim();
}

export async function generateStructuredOutput<TSchema extends z.ZodTypeAny>(
  model: BaseChatModel,
  prompt: string,
  schema: TSchema,
  systemHint?: string,
): Promise<z.infer<TSchema>> {
  const response = await model.invoke([
    new SystemMessage(
      systemHint ??
        "你是 Story Studio 结构化输出助手。只输出合法 JSON，不要 markdown 代码块，不要额外解释。",
    ),
    new HumanMessage(
      `${prompt}\n\n请严格按以下 JSON Schema 输出：\n${JSON.stringify(schema._def, null, 2)}`,
    ),
  ]);

  const text =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? response.content
            .map((part) =>
              typeof part === "string"
                ? part
                : "text" in part
                  ? String(part.text)
                  : "",
            )
            .join("")
        : String(response.content);

  const parsed = JSON.parse(extractJson(text));
  return schema.parse(parsed);
}
