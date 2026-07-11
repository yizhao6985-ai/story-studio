import { join } from "node:path";

import {
  DEEPSEEK_API_BASE_URL,
  DEFAULT_DEEPSEEK_CHAT_MODEL,
} from "@story-studio/shared/llm-config";

export function getLlmApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY_MISSING");
  }
  return apiKey;
}

export function getLlmBaseUrl(): string {
  return (
    process.env.STORY_STUDIO_LLM_BASE_URL?.trim() || DEEPSEEK_API_BASE_URL
  ).replace(/\/$/, "");
}

export function getChatModel(): string {
  return (
    process.env.STORY_STUDIO_CHAT_MODEL?.trim() || DEFAULT_DEEPSEEK_CHAT_MODEL
  );
}

/** 仅用于本地 CLI 调试时的 fallback，Electron 通过 MCP 操作文件。 */
export function getFallbackUserDataRoot(): string {
  return (
    process.env.STORY_STUDIO_USER_DATA?.trim() ||
    join(process.cwd(), ".story-studio-user-data")
  );
}
