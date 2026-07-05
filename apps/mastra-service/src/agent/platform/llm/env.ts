/**
 * Mastra 服务本地配置（LLM 凭据与路径均来自环境变量或 runtime 注册）。
 */
import { join } from "node:path";

import {
  DEEPSEEK_API_BASE_URL,
  DEFAULT_DEEPSEEK_CHAT_MODEL,
} from "@story-studio/shared/mastra-headers";

import { getRuntimeConfig } from "../runtime-config.js";

export function getUserDataRoot(): string {
  const fromRuntime = getRuntimeConfig()?.userDataRoot?.trim();
  if (fromRuntime) return fromRuntime;

  const root = process.env.STORY_STUDIO_USER_DATA?.trim();
  if (root) return root;

  // 独立 `mastra dev` 时尚无 Electron runtime 注册，使用本地目录启动 Studio。
  return join(process.cwd(), ".story-studio-user-data");
}

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
