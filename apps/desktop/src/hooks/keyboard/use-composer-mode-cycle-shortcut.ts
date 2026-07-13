import { useEventListener, useLatest } from "ahooks";

import { cycleComposerMode } from "@/features/composer-mode-selector";
import type { ComposerMode } from "@/hooks/types";

function isModeCycleShortcut(event: KeyboardEvent): boolean {
  if (!event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
    return false;
  }
  return event.key === "Tab" || event.code === "Tab";
}

function isExternalTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-composer-root]")) return false;
  if (target.closest(".monaco-editor")) return false;

  if (target.isContentEditable) return true;

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

type UseComposerModeCycleShortcutOptions = {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  disabled?: boolean;
};

export function useComposerModeCycleShortcut({
  mode,
  onModeChange,
  disabled = false,
}: UseComposerModeCycleShortcutOptions) {
  const modeRef = useLatest(mode);
  const onModeChangeRef = useLatest(onModeChange);

  useEventListener(
    "keydown",
    (event) => {
      if (!isModeCycleShortcut(event)) return;
      if (isExternalTextInput(event.target)) return;

      event.preventDefault();
      event.stopPropagation();
      cycleComposerMode(modeRef.current, onModeChangeRef.current);
    },
    { enable: !disabled, capture: true },
  );
}
