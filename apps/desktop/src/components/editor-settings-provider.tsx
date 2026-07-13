import { useLocalStorageState, useMemoizedFn } from "ahooks";
import { useMemo, type ReactNode } from "react";

import { EditorSettingsContext } from "@/hooks/settings/use-editor-settings";
import {
  DEFAULT_EDITOR_SETTINGS,
  parseStoredEditorSettings,
  type EditorSettings,
} from "@/lib/editor-settings";

const EDITOR_SETTINGS_STORAGE_KEY = "storyStudio.editorSettings";

export function EditorSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useLocalStorageState<EditorSettings>(
    EDITOR_SETTINGS_STORAGE_KEY,
    {
      defaultValue: DEFAULT_EDITOR_SETTINGS,
      deserializer: parseStoredEditorSettings,
    },
  );

  const updateSettings = useMemoizedFn((patch: Partial<EditorSettings>) => {
    setSettings((prev) => ({ ...(prev ?? DEFAULT_EDITOR_SETTINGS), ...patch }));
  });

  const value = useMemo(
    () => ({
      settings: settings ?? DEFAULT_EDITOR_SETTINGS,
      updateSettings,
    }),
    [settings, updateSettings],
  );

  return (
    <EditorSettingsContext.Provider value={value}>{children}</EditorSettingsContext.Provider>
  );
}
