import { useEventListener } from "@/hooks/lib/browser";

import { matchesShortcut } from "@/lib/keyboard-shortcuts";

type UseAppKeyboardShortcutsOptions = {
  showSettings: boolean;
  hasActiveConversation: boolean;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  onToggleWorkspacePanel: () => void;
  onCloseFileOrApp: () => void;
};

export function useAppKeyboardShortcuts({
  showSettings,
  hasActiveConversation,
  onOpenShortcuts,
  onOpenSettings,
  onToggleWorkspacePanel,
  onCloseFileOrApp,
}: UseAppKeyboardShortcutsOptions) {
  useEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      const target = event.target;
      const inTextField =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");

      if (matchesShortcut(event, ["mod", "W"])) {
        event.preventDefault();
        onCloseFileOrApp();
        return;
      }

      if (matchesShortcut(event, ["mod", "/"])) {
        event.preventDefault();
        onOpenShortcuts();
        return;
      }

      if (matchesShortcut(event, ["mod", ","])) {
        event.preventDefault();
        onOpenSettings();
        return;
      }

      if (inTextField) return;

      if (!showSettings && hasActiveConversation && matchesShortcut(event, ["mod", "B"])) {
        event.preventDefault();
        onToggleWorkspacePanel();
      }
    },
    { target: window },
  );
}
