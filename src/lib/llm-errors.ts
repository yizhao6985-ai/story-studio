export type LlmErrorKind =
  | "not_configured"
  | "auth"
  | "quota"
  | "content_policy"
  | "context_length"
  | "timeout"
  | "parse"
  | "network"
  | "unknown";

export type ClassifiedError = {
  kind: LlmErrorKind;
  retryable: boolean;
  userMessage: string;
  suggestion?: string;
  raw: string;
};

export const CONTENT_POLICY_USER_MESSAGE =
  "AI 服务平台拦截了本次内容（输入或输出可能触发内容审核）。";

export const CONTENT_POLICY_SUGGESTION =
  "建议：① 缩小讨论范围或指定段落；② 改用 Ask 模式做结构分析；③ 新开对话以减少上下文。作品文件未被修改。";

export const CONTENT_POLICY_FALLBACK_REPLY = `${CONTENT_POLICY_USER_MESSAGE}\n\n${CONTENT_POLICY_SUGGESTION}`;

/** 剥离 Electron IPC 与嵌套 Error 前缀，得到底层错误文案 */
export function normalizeAgentErrorMessage(raw: string): string {
  let message = raw.trim();
  if (!message) return message;

  const ipcMatch = message.match(
    /^Error invoking remote method '[^']+':\s*(?:Error:\s*)?([\s\S]+)$/i,
  );
  if (ipcMatch) {
    message = ipcMatch[1]!.trim();
  }

  while (message.startsWith("Error: ")) {
    message = message.slice("Error: ".length).trim();
  }

  return message;
}

function extractErrorText(error: unknown): string {
  if (error instanceof AgentRunError) {
    return error.raw || error.message;
  }
  if (error instanceof Error) {
    if (error.name === "LlmTimeoutError" || error.message.includes("LLM request timed out")) {
      return error.message;
    }
    return normalizeAgentErrorMessage(error.message);
  }
  return normalizeAgentErrorMessage(String(error));
}

const KIND_PREFIX = /^\[(not_configured|auth|quota|content_policy|context_length|timeout|parse|network|unknown)\]\s/;

function classifyByKindPrefix(raw: string): ClassifiedError | null {
  const match = raw.match(KIND_PREFIX);
  if (!match) return null;

  const kind = match[1] as LlmErrorKind;
  const userMessage = raw.slice(match[0].length).trim();
  const templates: Record<LlmErrorKind, Omit<ClassifiedError, "raw" | "userMessage">> = {
    not_configured: { kind: "not_configured", retryable: false },
    auth: { kind: "auth", retryable: false },
    quota: { kind: "quota", retryable: false },
    content_policy: {
      kind: "content_policy",
      retryable: true,
      suggestion: CONTENT_POLICY_SUGGESTION,
    },
    context_length: {
      kind: "context_length",
      retryable: false,
      suggestion: "可尝试只选中需要讨论的段落，或减少对话历史。",
    },
    timeout: { kind: "timeout", retryable: true },
    parse: { kind: "parse", retryable: true },
    network: { kind: "network", retryable: true },
    unknown: { kind: "unknown", retryable: false },
  };

  const template = templates[kind];
  const defaultMessages: Record<LlmErrorKind, string> = {
    not_configured: "AI 服务未配置，请先在设置中填写 API Key。",
    auth: "API Key 无效，请在设置中检查 Key 是否正确。",
    quota: "API 额度不足或已用尽，请在服务商控制台检查余额/配额后再试。",
    content_policy: CONTENT_POLICY_USER_MESSAGE,
    context_length: "上下文过长，请新开对话或缩短引用的作品内容。",
    timeout: "请求超时，请稍后重试。",
    parse: "模型返回格式异常，请重试。",
    network: "网络连接异常，请检查网络后重试。",
    unknown: userMessage,
  };

  return {
    ...template,
    userMessage: userMessage || defaultMessages[kind],
    raw,
  };
}

export function classifyLlmError(
  error: unknown,
  _context?: { node?: string },
): ClassifiedError {
  const raw = extractErrorText(error);
  const prefixed = classifyByKindPrefix(raw);
  if (prefixed) return prefixed;

  const lower = raw.toLowerCase();

  if (
    raw.includes("LLM_NOT_CONFIGURED") ||
    raw.includes("LLM_API_KEY_MISSING")
  ) {
    return {
      kind: "not_configured",
      retryable: false,
      userMessage: "AI 服务未配置，请先在设置中填写 API Key。",
      raw,
    };
  }

  if (
    lower.includes("invalid_api_key") ||
    lower.includes("incorrect api key") ||
    /\b401\b/.test(raw)
  ) {
    return {
      kind: "auth",
      retryable: false,
      userMessage: "API Key 无效，请在设置中检查 Key 是否正确。",
      raw,
    };
  }

  if (
    lower.includes("free allocated quota exceeded") ||
    lower.includes("insufficient_quota") ||
    (/\b403\b/.test(raw) && !lower.includes("content"))
  ) {
    return {
      kind: "quota",
      retryable: false,
      userMessage:
        "API 额度不足或已用尽，请在服务商控制台检查余额/配额后再试。",
      raw,
    };
  }

  if (
    lower.includes("inappropriate content") ||
    lower.includes("datainspectionfailed") ||
    lower.includes("data_inspection_failed") ||
    lower.includes("content_filter") ||
    lower.includes("responsibleaipolicyviolation") ||
    lower.includes("content management policy")
  ) {
    return {
      kind: "content_policy",
      retryable: true,
      userMessage: CONTENT_POLICY_USER_MESSAGE,
      suggestion: CONTENT_POLICY_SUGGESTION,
      raw,
    };
  }

  if (
    lower.includes("context_length") ||
    lower.includes("maximum context") ||
    lower.includes("token limit") ||
    lower.includes("too many tokens") ||
    lower.includes("context length exceeded")
  ) {
    return {
      kind: "context_length",
      retryable: false,
      userMessage: "上下文过长，请新开对话或缩短引用的作品内容。",
      suggestion: "可尝试只选中需要讨论的段落，或减少对话历史。",
      raw,
    };
  }

  if (
    error instanceof Error &&
    (error.name === "LlmTimeoutError" ||
      lower.includes("llm request timed out") ||
      lower.includes("the operation timed out") ||
      lower.includes("agent_run_timeout") ||
      lower.includes("agent_run_stall"))
  ) {
    return {
      kind: "timeout",
      retryable: true,
      userMessage: lower.includes("agent_run_stall")
        ? "执行过程中长时间无响应，已停止。请重试或缩小任务范围。"
        : lower.includes("agent_run_timeout")
          ? "执行时间过长，已自动停止。请拆分任务后重试。"
          : "请求超时，请稍后重试。",
      suggestion: "可将任务拆成多轮，或先用 Ask 模式探索。",
      raw,
    };
  }

  if (raw.includes("STRUCTURED_OUTPUT_PARSE_FAILED")) {
    return {
      kind: "parse",
      retryable: true,
      userMessage: "模型返回格式异常，请重试。",
      raw,
    };
  }

  if (raw.includes("MODELS_FETCH_FAILED")) {
    return {
      kind: "unknown",
      retryable: false,
      userMessage: `获取模型列表失败${raw.replace(/^MODELS_FETCH_FAILED:\s*/, "：")}`,
      raw,
    };
  }

  if (
    lower.includes("econnreset") ||
    lower.includes("enotfound") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("socket hang up")
  ) {
    return {
      kind: "network",
      retryable: true,
      userMessage: "网络连接异常，请检查网络后重试。",
      raw,
    };
  }

  return {
    kind: "unknown",
    retryable: false,
    userMessage: raw || "请求失败，请稍后重试。",
    raw: raw || "请求失败，请稍后重试。",
  };
}

export class AgentRunError extends Error {
  readonly kind: LlmErrorKind;
  readonly userMessage: string;
  readonly suggestion?: string;
  readonly raw: string;
  readonly node?: string;

  constructor(
    classified: ClassifiedError,
    options?: { node?: string; cause?: unknown },
  ) {
    const display = formatClassifiedErrorMessage(classified);
    super(`[${classified.kind}] ${display}`);
    this.name = "AgentRunError";
    this.kind = classified.kind;
    this.userMessage = classified.userMessage;
    this.suggestion = classified.suggestion;
    this.raw = classified.raw;
    this.node = options?.node;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function toAgentRunError(
  error: unknown,
  context?: { node?: string },
): AgentRunError {
  if (error instanceof AgentRunError) {
    return error;
  }
  const classified = classifyLlmError(error, context);
  return new AgentRunError(classified, { node: context?.node, cause: error });
}

export function isContentPolicyError(error: unknown): boolean {
  return classifyLlmError(error).kind === "content_policy";
}

export function formatClassifiedErrorMessage(classified: ClassifiedError): string {
  const parts: string[] = [classified.userMessage];
  if (classified.suggestion) {
    parts.push(classified.suggestion);
  }
  const detail = formatLlmErrorDetail(
    classified.raw,
    classified.userMessage,
    classified.suggestion,
  );
  if (detail) {
    parts.push(detail);
  }
  return parts.join("\n\n");
}

/** 在中文说明之外附加 LLM / API 原始报错，便于用户排查 */
export function formatLlmErrorDetail(
  raw: string,
  ...alreadyShown: (string | undefined)[]
): string | null {
  const normalized = normalizeAgentErrorMessage(raw)
    .replace(KIND_PREFIX, "")
    .trim();
  if (!normalized) return null;
  if (
    normalized === AGENT_USER_CANCEL_ABORT ||
    normalized === AGENT_RUN_TIMEOUT_ABORT
  ) {
    return null;
  }
  for (const text of alreadyShown) {
    if (!text?.trim()) continue;
    if (text.includes(normalized) || normalized.includes(text.trim())) {
      return null;
    }
  }
  if (normalized.includes("服务商返回：")) return null;
  return `服务商返回：${normalized}`;
}

export function formatAgentError(error: unknown): string {
  const classified = classifyLlmError(error);
  return formatClassifiedErrorMessage(classified);
}

export const AGENT_RUN_TIMEOUT_ABORT = "AGENT_RUN_TIMEOUT";
export const AGENT_USER_CANCEL_ABORT = "USER_CANCEL";

export const AGENT_RUN_TIMEOUT_MS = 600_000;
export const AGENT_RUN_STALL_MS = 150_000;

function getAbortReason(error: unknown): string | undefined {
  if (error instanceof DOMException && error.name === "AbortError") {
    return error.message;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return error.message;
  }
  return undefined;
}

/** 用户点击停止触发的取消（静默，不展示为错误） */
export function isUserCancelError(error: unknown): boolean {
  const reason = getAbortReason(error);
  if (reason === AGENT_USER_CANCEL_ABORT) return true;
  if (reason === AGENT_RUN_TIMEOUT_ABORT) return false;
  return isAbortError(error);
}

/** 整轮执行超时（由 runner 或前端 watchdog 触发） */
export function isAgentRunTimeoutError(error: unknown): boolean {
  const reason = getAbortReason(error);
  if (reason === AGENT_RUN_TIMEOUT_ABORT) return true;
  const raw = extractErrorText(error).toLowerCase();
  return raw.includes("agent_run_timeout") || raw.includes("agent_run_stall");
}

export function formatActivityErrorMessage(event: {
  message: string;
  suggestion?: string;
  detail?: string;
}): string {
  const parts: string[] = [event.message];
  if (event.suggestion) {
    parts.push(event.suggestion);
  }
  const detail = formatLlmErrorDetail(
    event.detail ?? "",
    event.message,
    event.suggestion,
  );
  if (detail) {
    parts.push(detail);
  }
  return parts.join("\n\n");
}

export function classifiedToActivityError(classified: ClassifiedError): {
  kind: LlmErrorKind;
  message: string;
  suggestion?: string;
  detail?: string;
} {
  return {
    kind: classified.kind,
    message: classified.userMessage,
    suggestion: classified.suggestion,
    detail: classified.raw,
  };
}

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
