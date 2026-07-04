/** 用户主动取消 agent 请求（含 Electron IPC 包装的 AbortError） */
export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") return true;
    const msg = error.message.toLowerCase();
    if (msg.includes("abort") || msg.includes("aborted")) return true;
  }
  const text = String(error).toLowerCase();
  return text.includes("abort") || text.includes("aborted");
}

/** 将主进程/API 原始错误转为用户可读文案 */
export function formatLlmErrorMessage(raw: string): string {
  const message = raw.trim();
  if (!message) return "请求失败，请稍后重试。";

  if (
    message.includes("invalid_api_key") ||
    message.includes("Incorrect API key") ||
    /\b401\b/.test(message)
  ) {
    return "API Key 无效，请在设置中检查 Key 是否正确。";
  }

  if (
    message.includes("Free allocated quota exceeded") ||
    message.includes("insufficient_quota") ||
    /\b403\b/.test(message)
  ) {
    return "API 额度不足或已用尽，请在服务商控制台检查余额/配额后再试。";
  }

  if (message.includes("MODELS_FETCH_FAILED")) {
    return `获取模型列表失败${message.replace(/^MODELS_FETCH_FAILED:\s*/, "：")}`;
  }

  if (message.includes("LLM_NOT_CONFIGURED") || message.includes("LLM_API_KEY_MISSING")) {
    return "AI 服务未配置，请先在设置中填写 API Key。";
  }

  return message;
}
