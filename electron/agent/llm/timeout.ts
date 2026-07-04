/** Agent ↔ LLM 集中超时与重试（超时 abort 后最多再试 1 次）。 */
export const LLM_TIMEOUT_MS = {
  chat: 120_000,
  structured: 180_000,
} as const;

const MAX_ATTEMPTS = 2;

class LlmTimeoutError extends Error {
  readonly code = "LLM_TIMEOUT" as const;

  constructor(
    readonly timeoutMs: number,
    readonly attempts: number,
    options?: { cause?: unknown },
  ) {
    super(
      `LLM request timed out after ${attempts} attempt(s) (${timeoutMs}ms each)`,
    );
    this.name = "LlmTimeoutError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

function isTimeoutError(error: unknown): boolean {
  if (error != null && typeof error === "object" && "name" in error) {
    return (error as { name: string }).name === "TimeoutError";
  }
  return false;
}

function isTimeoutDeadline(deadline: AbortSignal): boolean {
  if (!deadline.aborted) return false;
  return isTimeoutError(deadline.reason) || deadline.reason == null;
}

function isTimeoutLike(deadline: AbortSignal, error: unknown): boolean {
  return isTimeoutDeadline(deadline) || isTimeoutError(error);
}

/** LangChain structured invoke 可能不响应 AbortSignal；Promise.race 兜底硬超时。 */
function createHardTimeout(timeoutMs: number): {
  promise: Promise<never>;
  clear: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new DOMException("The operation timed out.", "TimeoutError"));
    }, timeoutMs);
  });
  return {
    promise,
    clear: () => {
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}

function throwLlmTimeout(
  timeoutMs: number,
  attempts: number,
  cause: unknown,
): never {
  throw new LlmTimeoutError(timeoutMs, attempts, { cause });
}

export async function withLlmRetry<T>(opts: {
  parentSignal?: AbortSignal;
  timeoutMs: number;
  /** 默认 2；suggestions 等可跳过环节传 1 禁用超时重试 */
  maxAttempts?: number;
  run: (signal: AbortSignal) => Promise<T>;
  /** streamChat：已有 chunk 输出时不重试 */
  canRetry?: () => boolean;
}): Promise<T> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? MAX_ATTEMPTS);
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const deadline = AbortSignal.timeout(opts.timeoutMs);
    const signal = opts.parentSignal
      ? AbortSignal.any([opts.parentSignal, deadline])
      : deadline;

    const hardTimeout = createHardTimeout(opts.timeoutMs);

    try {
      return await Promise.race([opts.run(signal), hardTimeout.promise]);
    } catch (error) {
      lastError = error;

      if (opts.parentSignal?.aborted) {
        throw error;
      }

      if (opts.canRetry && !opts.canRetry()) {
        if (isTimeoutLike(deadline, error)) {
          throwLlmTimeout(opts.timeoutMs, attempt + 1, error);
        }
        throw error;
      }

      if (!isTimeoutLike(deadline, error)) {
        throw error;
      }

      if (attempt === maxAttempts - 1) {
        throwLlmTimeout(opts.timeoutMs, maxAttempts, error);
      }
    } finally {
      hardTimeout.clear();
    }
  }

  if (lastError != null) {
    throwLlmTimeout(opts.timeoutMs, maxAttempts, lastError);
  }

  throw new LlmTimeoutError(opts.timeoutMs, maxAttempts);
}
