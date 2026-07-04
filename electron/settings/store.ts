import { app, safeStorage } from "electron";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import {
  fetchChatModelsFromApi,
  type ChatModelOption,
} from "../agent/llm/fetch-models.js";

type StoredSettings = {
  apiKeyEncrypted: string;
  baseUrl: string;
  chatModel?: string;
};

export type LlmSettingsStatus = {
  configured: boolean;
  baseUrl: string;
};

export type LlmPreferences = {
  configured: boolean;
  baseUrl: string;
  chatModel: string;
  chatModels: { id: string; label: string }[];
  modelsError?: string;
};

export type LlmRuntimeSettings = {
  apiKey: string;
  baseUrl: string;
  apiBaseUrl: string;
};

let cachedChatModels: ChatModelOption[] | null = null;
let cacheCredentialsKey: string | null = null;

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

function assertEncryptionAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "SAFE_STORAGE_UNAVAILABLE: 系统密钥链不可用，无法安全保存 API Key",
    );
  }
}

function readStoredSettings(): StoredSettings | null {
  const path = settingsPath();
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    if (
      typeof parsed.apiKeyEncrypted !== "string" ||
      typeof parsed.baseUrl !== "string"
    ) {
      return null;
    }
    return {
      apiKeyEncrypted: parsed.apiKeyEncrypted,
      baseUrl: parsed.baseUrl,
      ...(typeof parsed.chatModel === "string"
        ? { chatModel: parsed.chatModel }
        : {}),
    };
  } catch {
    return null;
  }
}

function writeStoredSettings(settings: StoredSettings): void {
  const path = settingsPath();
  mkdirSync(app.getPath("userData"), { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2), "utf-8");
}

function decryptApiKey(encrypted: string): string {
  if (!encrypted) return "";
  assertEncryptionAvailable();
  return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
}

function encryptApiKey(apiKey: string): string {
  assertEncryptionAvailable();
  return safeStorage.encryptString(apiKey).toString("base64");
}

function deriveApiBaseUrl(baseUrl: string): string {
  if (!baseUrl.trim()) return "";
  return `${new URL(baseUrl).origin}/api/v1`;
}

function getCredentialsKey(apiKey: string, baseUrl: string): string {
  return `${baseUrl}::${apiKey}`;
}

function invalidateChatModelsCache(): void {
  cachedChatModels = null;
  cacheCredentialsKey = null;
}

function resolveSelectedChatModel(
  storedModel: string | undefined,
  models: ChatModelOption[],
): string {
  if (storedModel && models.some((item) => item.id === storedModel)) {
    return storedModel;
  }
  return models[0]?.id ?? storedModel ?? "";
}

async function loadChatModels(force = false): Promise<ChatModelOption[]> {
  const { apiKey, baseUrl } = getLlmSettings();
  if (!apiKey.trim() || !baseUrl.trim()) {
    invalidateChatModelsCache();
    return [];
  }

  const key = getCredentialsKey(apiKey, baseUrl);
  if (!force && cachedChatModels !== null && cacheCredentialsKey === key) {
    return cachedChatModels;
  }

  const models = await fetchChatModelsFromApi(apiKey, baseUrl);
  cachedChatModels = models;
  cacheCredentialsKey = key;
  return models;
}

function setChatModelsCache(
  apiKey: string,
  baseUrl: string,
  models: ChatModelOption[],
): void {
  cachedChatModels = models;
  cacheCredentialsKey = getCredentialsKey(apiKey, baseUrl);
}

export function isLlmConfigured(): boolean {
  const stored = readStoredSettings();
  if (!stored?.apiKeyEncrypted || !stored.baseUrl.trim()) return false;

  try {
    const apiKey = decryptApiKey(stored.apiKeyEncrypted);
    return apiKey.trim().length > 0;
  } catch {
    return false;
  }
}

export function getSelectedChatModel(): string {
  return readStoredSettings()?.chatModel?.trim() ?? "";
}

export async function getLlmPreferences(): Promise<LlmPreferences> {
  const stored = readStoredSettings();
  if (!isLlmConfigured()) {
    return {
      configured: false,
      baseUrl: stored?.baseUrl ?? "",
      chatModel: stored?.chatModel ?? "",
      chatModels: [],
    };
  }

  try {
    const chatModels = await loadChatModels();
    return {
      configured: true,
      baseUrl: stored?.baseUrl ?? "",
      chatModel: resolveSelectedChatModel(stored?.chatModel, chatModels),
      chatModels,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      configured: true,
      baseUrl: stored?.baseUrl ?? "",
      chatModel: stored?.chatModel ?? "",
      chatModels: [],
      modelsError: message.replace(/^MODELS_FETCH_FAILED:\s*/, ""),
    };
  }
}

export async function setChatModel(modelId: string): Promise<void> {
  const trimmed = modelId.trim();
  if (!trimmed) {
    throw new Error("INVALID_CHAT_MODEL");
  }

  const models = await loadChatModels();
  if (!models.some((item) => item.id === trimmed)) {
    throw new Error("INVALID_CHAT_MODEL");
  }

  const stored = readStoredSettings();
  if (!stored) {
    throw new Error("LLM_NOT_CONFIGURED");
  }

  writeStoredSettings({
    ...stored,
    chatModel: trimmed,
  });
}

export function getLlmSettingsStatus(): LlmSettingsStatus {
  const stored = readStoredSettings();
  return {
    configured: isLlmConfigured(),
    baseUrl: stored?.baseUrl ?? "",
  };
}

export function getLlmSettings(): LlmRuntimeSettings {
  const stored = readStoredSettings();
  const baseUrl = stored?.baseUrl ?? "";

  if (!stored?.apiKeyEncrypted) {
    return { apiKey: "", baseUrl, apiBaseUrl: deriveApiBaseUrl(baseUrl) };
  }

  try {
    const apiKey = decryptApiKey(stored.apiKeyEncrypted);
    return { apiKey, baseUrl, apiBaseUrl: deriveApiBaseUrl(baseUrl) };
  } catch {
    return { apiKey: "", baseUrl, apiBaseUrl: deriveApiBaseUrl(baseUrl) };
  }
}

export async function saveLlmSettings(input: {
  apiKey: string;
  baseUrl?: string;
}): Promise<void> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error("API_KEY_REQUIRED");
  }

  const baseUrl = input.baseUrl?.trim();
  if (!baseUrl) {
    throw new Error("BASE_URL_REQUIRED");
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  invalidateChatModelsCache();

  const chatModels = await fetchChatModelsFromApi(apiKey, normalizedBaseUrl);
  if (chatModels.length === 0) {
    throw new Error("NO_CHAT_MODELS_AVAILABLE");
  }

  writeStoredSettings({
    apiKeyEncrypted: encryptApiKey(apiKey),
    baseUrl: normalizedBaseUrl,
    chatModel: chatModels[0]!.id,
  });
  setChatModelsCache(apiKey, normalizedBaseUrl, chatModels);
}

export async function updateLlmSettings(input: {
  apiKey?: string;
  baseUrl?: string;
}): Promise<void> {
  const stored = readStoredSettings();
  const current = getLlmSettings();
  const apiKey = input.apiKey?.trim() || current.apiKey;
  const baseUrl = (input.baseUrl?.trim() || current.baseUrl).replace(/\/$/, "");

  if (!apiKey) {
    throw new Error("API_KEY_REQUIRED");
  }
  if (!baseUrl) {
    throw new Error("BASE_URL_REQUIRED");
  }

  writeStoredSettings({
    apiKeyEncrypted:
      stored?.apiKeyEncrypted && !input.apiKey?.trim()
        ? stored.apiKeyEncrypted
        : encryptApiKey(apiKey),
    baseUrl,
    chatModel: stored?.chatModel,
  });

  invalidateChatModelsCache();

  try {
    const chatModels = await loadChatModels(true);
    const latest = readStoredSettings();
    if (!latest) return;

    const nextChatModel = resolveSelectedChatModel(
      latest.chatModel,
      chatModels,
    );
    if (nextChatModel !== latest.chatModel) {
      writeStoredSettings({
        ...latest,
        chatModel: nextChatModel,
      });
    }
  } catch {
    /* 保留已保存的 chatModel，等待下次刷新模型列表 */
  }
}

export function clearLlmSettings(): void {
  invalidateChatModelsCache();
  const path = settingsPath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export async function validateLlmSettings(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const { apiKey, baseUrl } = getLlmSettings();
  if (!apiKey) {
    return { ok: false, message: "请先填写 API Key" };
  }
  if (!baseUrl) {
    return { ok: false, message: "请先填写 API Base URL" };
  }

  try {
    const chatModels = await loadChatModels(true);
    if (chatModels.length === 0) {
      return {
        ok: false,
        message:
          "未能获取可用对话模型，请确认 Base URL 支持 OpenAI 兼容的 /models 接口",
      };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("MODELS_FETCH_FAILED:")) {
      return {
        ok: false,
        message: `获取模型列表失败${message.replace(/^MODELS_FETCH_FAILED:/, "")}`,
      };
    }
    return { ok: false, message: `连接失败：${message}` };
  }
}
