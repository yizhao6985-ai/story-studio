import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, KeyRound } from "lucide-react";

import { useLlmPreferences } from "@/hooks/settings/use-llm-preferences";
import { COMPOSER_TAG_BUTTON_CLASS } from "@/lib/composer-chrome";
import { requestOpenSettings } from "@/lib/settings-navigation";
import { cn } from "@/lib/utils";

type LlmProviderTagProps = {
  className?: string;
  disabled?: boolean;
  menuAlign?: "start" | "end";
};

/** 与模型项 py-1.5 + text-xs 单行高度一致 */
const MODEL_MENU_ITEM_HEIGHT_PX = 28;
const MAX_VISIBLE_MODELS = 9;
const MODEL_LIST_MAX_HEIGHT_PX = MODEL_MENU_ITEM_HEIGHT_PX * MAX_VISIBLE_MODELS;

export function LlmProviderTag({
  className,
  disabled = false,
  menuAlign = "start",
}: LlmProviderTagProps) {
  const { preferences, setChatModel } = useLlmPreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  if (!preferences) return null;

  const activeModel = preferences.chatModels.find(
    (item) => item.id === preferences.chatModel,
  );
  const modelLabel =
    activeModel?.label ?? preferences.chatModel ?? "未选择模型";

  return (
    <div ref={menuRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        disabled={disabled || preferences.chatModels.length === 0}
        onClick={() => setMenuOpen((open) => !open)}
        className={cn(
          COMPOSER_TAG_BUTTON_CLASS,
          "border-border/60 bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
          menuOpen && "bg-foreground/[0.06] text-foreground",
          (disabled || preferences.chatModels.length === 0) &&
            "cursor-not-allowed opacity-50",
        )}
        title={
          preferences.modelsError
            ? `模型列表加载失败：${preferences.modelsError}`
            : `${preferences.providerLabel} · ${modelLabel}`
        }
      >
        {modelLabel}
        <ChevronDown className="size-3 opacity-70" />
      </button>

      {menuOpen && (
        <div
          className={cn(
            "absolute bottom-full z-20 mb-1.5 min-w-[188px] overflow-hidden rounded-none border border-border bg-popover py-1 shadow-lg",
            menuAlign === "end" ? "right-0" : "left-0",
          )}
        >
          <p className="px-2.5 py-1 text-[10px] font-medium tracking-wide text-muted-foreground">
            切换模型
          </p>
          {preferences.modelsError ? (
            <p className="px-2.5 py-1.5 text-xs text-destructive">
              {preferences.modelsError}
            </p>
          ) : null}
          <div
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: MODEL_LIST_MAX_HEIGHT_PX }}
          >
            {preferences.chatModels.map((item) => {
              const selected = item.id === preferences.chatModel;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    void setChatModel(item.id).then(() => setMenuOpen(false));
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-foreground/[0.06]",
                    selected && "bg-foreground/[0.04] text-foreground",
                  )}
                >
                  <span className="font-medium">{item.label}</span>
                  {selected ? <Check className="size-3 shrink-0 text-foreground" /> : null}
                </button>
              );
            })}
          </div>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              requestOpenSettings("ai-service");
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <KeyRound className="size-3 shrink-0" />
            修改 API Key
          </button>
        </div>
      )}
    </div>
  );
}
