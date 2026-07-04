function contentPartToText(part: unknown): string {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";

  const block = part as {
    type?: string;
    text?: unknown;
    content?: unknown;
  };

  if (block.type === "preview_selection") return "";
  if (typeof block.text === "string") return block.text;
  if (typeof block.content === "string") return block.content;
  return "";
}

/** 从 LangChain / LangGraph checkpoint 消息 content 中提取纯文本。 */
export function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";

  if (Array.isArray(content)) {
    return content.map(contentPartToText).join("");
  }

  if (typeof content === "object") {
    return contentPartToText(content);
  }

  return "";
}
