import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { ComposerMode } from "@/hooks/types";
import { formatShortcutKey } from "@/lib/keyboard-shortcuts";
import { COMPOSER_TAG_BUTTON_CLASS } from "@/lib/composer-chrome";
import { cn } from "@/lib/utils";

const MODE_CYCLE_SHORTCUT = ["shift", "Tab"] as const;

export const COMPOSER_MODE_OPTIONS: {
  id: ComposerMode;
  label: string;
  description: string;
}[] = [
  { id: "ask", label: "提问", description: "只读工作区，回答问题" },
  { id: "normal", label: "创作", description: "探索作品结构后修改文件" },
];

const MODE_TAG_STYLES: Record<ComposerMode, string> = {
  ask: "border-success/25 bg-success/10 text-success",
  normal: "border-border bg-foreground/[0.04] text-foreground",
};

export function cycleComposerMode(
  mode: ComposerMode,
  onModeChange: (mode: ComposerMode) => void,
) {
  const index = COMPOSER_MODE_OPTIONS.findIndex((item) => item.id === mode);
  const next = COMPOSER_MODE_OPTIONS[(index + 1) % COMPOSER_MODE_OPTIONS.length]!;
  onModeChange(next.id);
}

type ComposerModeSelectorProps = {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  disabled?: boolean;
  locked?: boolean;
  className?: string;
};

export function ComposerModeSelector({
  mode,
  onModeChange,
  disabled = false,
  locked = false,
  className,
}: ComposerModeSelectorProps) {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modeMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setModeMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [modeMenuOpen]);

  const activeMode = COMPOSER_MODE_OPTIONS.find((item) => item.id === mode)!;

  return (
    <div ref={menuRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setModeMenuOpen((open) => !open)}
        title={
          locked
            ? "当前对话已锁定模式，请新建对话以切换"
            : "切换模式 (Shift + Tab)"
        }
        className={cn(
          COMPOSER_TAG_BUTTON_CLASS,
          MODE_TAG_STYLES[mode],
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {activeMode.label}
        <ChevronDown className="size-3 opacity-70" />
      </button>

      {modeMenuOpen && (
        <div className="absolute bottom-full left-0 z-20 mb-1.5 min-w-[200px] overflow-hidden rounded-none border border-border bg-popover py-1 shadow-lg">
          {COMPOSER_MODE_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (disabled) return;
                onModeChange(item.id);
                setModeMenuOpen(false);
              }}
              className={cn(
                "flex w-full cursor-pointer flex-col gap-0.5 px-2.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.06]",
                mode === item.id && "bg-foreground/[0.04]",
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  item.id === "ask" && "text-success",
                  item.id === "normal" && "text-foreground",
                )}
              >
                {item.label}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {item.description}
              </span>
            </button>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-border px-2.5 py-1.5">
            <span className="text-[10px] text-muted-foreground">循环切换</span>
            <span className="flex shrink-0 items-center gap-1">
              {MODE_CYCLE_SHORTCUT.map((key, index) => (
                <span key={key} className="flex items-center gap-1">
                  {index > 0 ? (
                    <span className="text-[10px] text-muted-foreground">+</span>
                  ) : null}
                  <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded border border-border bg-foreground/[0.04] px-1 py-px font-mono text-[10px] text-foreground">
                    {formatShortcutKey(key)}
                  </kbd>
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
