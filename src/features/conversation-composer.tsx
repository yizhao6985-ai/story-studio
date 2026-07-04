import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ComposerModeSelector,
  cycleComposerMode,
} from "@/features/composer-mode-selector";
import { DelegateMaxTurnsControl } from "@/features/delegate-max-turns-control";
import { LlmProviderTag } from "@/features/llm-provider-tag";
import {
  ContextUsageMeter,
  type ContextUsageInfo,
} from "@/features/context-usage-meter";
import { useAutoResizeTextarea } from "@/hooks/input/use-auto-resize-textarea";
import type { ComposerMode, DelegateSessionInfo } from "@/hooks/types";
import { COMPOSER_TEXTAREA_CLASS } from "@/lib/composer-chrome";
import { cn } from "@/lib/utils";

type ConversationComposerProps = {
  value: string;
  onChange: (value: string) => void;
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  delegateMaxTurns: number;
  onDelegateMaxTurnsChange: (maxTurns: number) => void;
  onSend: () => void;
  onStop?: () => void;
  loading: boolean;
  disabled: boolean;
  canSend: boolean;
  placeholder?: string;
  contextUsage?: ContextUsageInfo | null;
  delegateSession?: DelegateSessionInfo | null;
};

export function ConversationComposer({
  value,
  onChange,
  mode,
  onModeChange,
  delegateMaxTurns,
  onDelegateMaxTurnsChange,
  onSend,
  onStop,
  loading,
  disabled,
  canSend,
  placeholder = "对 Story Studio 说…",
  contextUsage = null,
  delegateSession = null,
}: ConversationComposerProps) {
  const textareaRef = useAutoResizeTextarea({ value, minRows: 1, maxRows: 5 });

  const isDelegateMode = mode === "delegate";

  const modeSwitchDisabled = disabled || (loading && isDelegateMode);
  const maxTurnsControlDisabled =
    modeSwitchDisabled || Boolean(delegateSession);

  const cycleMode = () => {
    if (modeSwitchDisabled) return;
    cycleComposerMode(mode, onModeChange);
  };

  const handlePrimaryAction = () => {
    if (loading) {
      onStop?.();
      return;
    }
    void onSend();
  };

  return (
    <div className="w-full space-y-2">
      {delegateSession && (
        <div className="rounded-none border border-delegate/20 bg-delegate/5 px-3 py-1.5 text-xs text-delegate backdrop-blur-sm">
          托管中 · 第 {delegateSession.turn}/{delegateSession.maxTurns} 轮
          {delegateSession.artifactPaths.length > 0
            ? ` · 已产出 ${delegateSession.artifactPaths.length} 个文件`
            : " · 尚无落盘产出"}
        </div>
      )}
      <div className="group w-full rounded-none border border-border bg-card transition-[border-color] duration-150 focus-within:border-foreground/20">
        <div className="flex items-end gap-1.5 px-2 py-1.5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            rows={1}
            disabled={disabled || (loading && isDelegateMode)}
            className={cn(
              "block max-h-[120px] flex-1 resize-none border-none bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
              COMPOSER_TEXTAREA_CLASS,
            )}
            onKeyDown={(event) => {
              if (event.key === "Tab" && event.shiftKey) {
                event.preventDefault();
                cycleMode();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (loading || canSend) handlePrimaryAction();
                return;
              }
            }}
          />

          <Button
            type="button"
            variant="primary"
            size="icon"
            className="size-7 shrink-0 rounded-none"
            onClick={handlePrimaryAction}
            disabled={disabled || (!loading && !canSend)}
            aria-label={loading ? "停止" : isDelegateMode ? "开始托管" : "发送"}
            title={
              loading ? "停止" : isDelegateMode ? "开始托管 (Enter)" : "发送 (Enter)"
            }
          >
            {loading ? (
              <Square
                className="size-3 animate-send-icon-pulse fill-current"
                strokeWidth={0}
              />
            ) : (
              <ArrowUp className="size-3.5" strokeWidth={2} />
            )}
          </Button>
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ComposerModeSelector
            mode={mode}
            onModeChange={onModeChange}
            disabled={modeSwitchDisabled}
          />
          {isDelegateMode ? (
            <DelegateMaxTurnsControl
              value={delegateMaxTurns}
              onChange={onDelegateMaxTurnsChange}
              disabled={maxTurnsControlDisabled}
            />
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <ContextUsageMeter usage={contextUsage} />
          <LlmProviderTag disabled={disabled} menuAlign="end" />
        </div>
      </div>
    </div>
  );
}
