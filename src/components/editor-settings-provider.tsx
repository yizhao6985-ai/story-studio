import { useCallback, useMemo, useState, type ReactNode } from "react";

import { EditorSettingsContext } from "@/hooks/settings/use-editor-settings";
import {
  readStoredEditorSettings,
  writeStoredEditorSettings,
  type EditorSettings,
} from "@/lib/editor-settings";

export function EditorSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState(readStoredEditorSettings);

  const updateSettings = useCallback((patch: Partial<EditorSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      writeStoredEditorSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
    }),
    [settings, updateSettings],
  );

  return (
    <EditorSettingsContext.Provider value={value}>{children}</EditorSettingsContext.Provider>
  );
}
