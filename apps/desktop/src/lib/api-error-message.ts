import {
  classifyLlmError,
  formatClassifiedErrorMessage,
  normalizeAgentErrorMessage,
} from "./llm-errors";

export {
  classifyLlmError,
  formatAgentError,
  formatActivityErrorMessage,
  classifiedToActivityError,
  formatClassifiedErrorMessage,
  formatLlmErrorDetail,
  isAbortError,
  isUserCancelError,
  isAgentRunTimeoutError,
  normalizeAgentErrorMessage,
  AGENT_RUN_STALL_MS,
  AGENT_RUN_TIMEOUT_MS,
  type ClassifiedError,
  type LlmErrorKind,
} from "./llm-errors";

/** 将主进程/API 原始错误转为用户可读文案 */
export function formatLlmErrorMessage(raw: string): string {
  const message = normalizeAgentErrorMessage(raw);
  if (!message) return "请求失败，请稍后重试。";
  return formatClassifiedErrorMessage(classifyLlmError(message));
}
