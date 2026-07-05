import { AlertCircle } from "lucide-react";

import type { LlmErrorDisplay } from "@/lib/agent-error-display";

type LlmErrorAlertProps = {
  error: LlmErrorDisplay;
};

export function LlmErrorAlert({ error }: LlmErrorAlertProps) {
  return (
    <div
      role="alert"
      className="rounded-none border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-destructive shadow-sm"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide">
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
        <span>AI 服务错误</span>
        <span className="font-normal text-destructive/70">·</span>
        <span>{error.title}</span>
      </div>
      <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-destructive">
        {error.detail}
      </pre>
      {error.hint ? (
        <p className="mt-2 text-xs leading-relaxed text-destructive/85">{error.hint}</p>
      ) : null}
      {error.suggestion ? (
        <p className="mt-1 text-[11px] leading-relaxed text-destructive/70">
          {error.suggestion}
        </p>
      ) : null}
    </div>
  );
}
