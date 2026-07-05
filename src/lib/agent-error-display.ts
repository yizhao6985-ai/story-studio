import type { AgentActivityEvent } from "@/hooks/types";

import {
  AGENT_RUN_TIMEOUT_ABORT,
  AGENT_USER_CANCEL_ABORT,
  classifyLlmError,
  formatLlmErrorDetail,
  normalizeAgentErrorMessage,
  type ClassifiedError,
  type LlmErrorKind,
} from "./llm-errors";

export type LlmErrorDisplay = {
  kind: LlmErrorKind;
  title: string;
  detail: string;
  hint?: string;
  suggestion?: string;
};

export const LLM_ERROR_KIND_LABELS: Record<LlmErrorKind, string> = {
  not_configured: "未配置",
  auth: "认证失败",
  quota: "额度不足",
  content_policy: "内容审核",
  context_length: "上下文过长",
  timeout: "请求超时",
  parse: "返回格式异常",
  network: "网络异常",
  unknown: "未知错误",
};

/** 对话气泡内：程序接管后的简短说明（不含 LLM 原始报错） */
export const AGENT_RUN_INCOMPLETE_MESSAGE =
  "本轮未能完成。请查看下方 AI 服务错误提示。";

/** 程序层降级完成时的气泡文案（如内容审核后未生成正文） */
export const AGENT_RUN_DEGRADED_MESSAGE =
  "本轮未生成完整回复，AI 服务返回错误，详情请见下方红色提示。";

const APP_STALL_MESSAGE =
  "执行过程中长时间无响应，已自动停止。请缩小任务范围后重试。";

const APP_RUN_TIMEOUT_MESSAGE =
  "执行时间过长，已自动停止。请拆分任务后重试。";

export function isLlmLayerError(
  classified: ClassifiedError,
  error?: unknown,
): boolean {
  const raw = classified.raw.toLowerCase();
  if (raw.includes("agent_run_stall") || raw.includes("agent_run_timeout")) {
    return false;
  }
  if (raw === AGENT_USER_CANCEL_ABORT.toLowerCase()) return false;

  const reason =
    error instanceof DOMException
      ? error.message
      : error instanceof Error
        ? error.message
        : "";
  if (
    reason === AGENT_RUN_TIMEOUT_ABORT ||
    reason === AGENT_USER_CANCEL_ABORT
  ) {
    return false;
  }

  if (
    classified.kind === "timeout" &&
    (raw.includes("agent_run_stall") ||
      classified.userMessage.includes("长时间无响应") ||
      classified.userMessage.includes("执行时间过长，已自动停止"))
  ) {
    return false;
  }

  return true;
}

export function extractLlmApiDetail(classified: ClassifiedError): string {
  const fromDetail = formatLlmErrorDetail(
    classified.raw,
    classified.userMessage,
    classified.suggestion,
  );
  if (fromDetail) {
    return fromDetail.replace(/^服务商返回：/, "").trim();
  }

  const normalized = normalizeAgentErrorMessage(classified.raw)
    .replace(/^\[[^\]]+\]\s*/, "")
    .trim();

  if (!normalized) return classified.userMessage;
  if (
    normalized === classified.userMessage ||
    classified.userMessage.includes(normalized)
  ) {
    return normalized;
  }
  return normalized;
}

export function toLlmErrorDisplay(classified: ClassifiedError): LlmErrorDisplay {
  return {
    kind: classified.kind,
    title: LLM_ERROR_KIND_LABELS[classified.kind],
    detail: extractLlmApiDetail(classified),
    hint:
      classified.userMessage !== extractLlmApiDetail(classified)
        ? classified.userMessage
        : undefined,
    suggestion: classified.suggestion,
  };
}

export function toLlmErrorDisplayFromUnknown(error: unknown): LlmErrorDisplay | null {
  const classified = classifyLlmError(error);
  if (!isLlmLayerError(classified, error)) return null;
  return toLlmErrorDisplay(classified);
}

export function toAppRunNotice(error: unknown): string | null {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("长时间无响应")) return APP_STALL_MESSAGE;
    if (msg.includes("执行时间过长")) return APP_RUN_TIMEOUT_MESSAGE;
  }
  const classified = classifyLlmError(error);
  if (!isLlmLayerError(classified, error)) {
    if (classified.userMessage.includes("长时间无响应")) return APP_STALL_MESSAGE;
    if (classified.userMessage.includes("执行时间过长")) {
      return APP_RUN_TIMEOUT_MESSAGE;
    }
    return classified.userMessage || null;
  }
  return null;
}

export function activityErrorToLlmDisplay(
  event: Extract<AgentActivityEvent, { type: "error" }>,
): LlmErrorDisplay | null {
  if (event.source === "app") return null;

  return toLlmErrorDisplay({
    kind: (event.kind as LlmErrorKind | undefined) ?? "unknown",
    retryable: false,
    userMessage: event.message,
    suggestion: event.suggestion,
    raw: event.detail ?? event.message,
  });
}

export function resolveRunFailure(error: unknown): {
  llm: LlmErrorDisplay | null;
  appNotice: string | null;
  assistantMessage: string;
} {
  const llm = toLlmErrorDisplayFromUnknown(error);
  if (llm) {
    return {
      llm,
      appNotice: null,
      assistantMessage: AGENT_RUN_INCOMPLETE_MESSAGE,
    };
  }

  return {
    llm: null,
    appNotice: toAppRunNotice(error),
    assistantMessage:
      "任务已停止。如仍无法继续，请缩小任务范围或新开对话后再试。",
  };
}
