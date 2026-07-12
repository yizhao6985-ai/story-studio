import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ComposerModeSelector, cycleComposerMode } from "@/features/composer-mode-selector";
import { useAutoResizeTextarea } from "@/hooks/input/use-auto-resize-textarea";
import type { ComposerMode } from "@/hooks/types";
import { COMPOSER_TEXTAREA_CLASS } from "@/lib/composer-chrome";
import { cn } from "@/lib/utils";

type ConversationComposerProps = {
  value: string;
  onChange: (value: string) => void;
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  onSend: () => void;
  onStop?: () => void;
  loading: boolean;
  disabled: boolean;
  canSend: boolean;
  placeholder?: string;
};

export function ConversationComposer({
  value,
  onChange,
  mode,
  onModeChange,
  onSend,
  onStop,
  loading,
  disabled,
  canSend,
  placeholder = "对 Story Studio 说…",
}: ConversationComposerProps) {
  const textareaRef = useAutoResizeTextarea({ value, minRows: 1, maxRows: 5 });

  const modeSwitchDisabled = disabled;

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
    <div className="w-full space-y-2" data-composer-root>
      <div className="group w-full rounded-none border border-border bg-card transition-[border-color] duration-150 focus-within:border-foreground/20">
        <div className="flex items-end gap-1.5 px-2 py-1.5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
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
            aria-label={loading ? "停止" : "发送"}
            title={loading ? "停止" : "发送 (Enter)"}
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
        <ComposerModeSelector
          mode={mode}
          onModeChange={onModeChange}
          disabled={modeSwitchDisabled}
        />
      </div>
    </div>
  );
}
