import { createContext, useContext } from "react";

import type { EditorSettings } from "@/lib/editor-settings";

type EditorSettingsContextValue = {
  settings: EditorSettings;
  updateSettings: (patch: Partial<EditorSettings>) => void;
};

export const EditorSettingsContext = createContext<EditorSettingsContextValue | null>(null);

export function useEditorSettings(): EditorSettingsContextValue {
  const context = useContext(EditorSettingsContext);
  if (!context) {
    throw new Error("useEditorSettings must be used within EditorSettingsProvider");
  }
  return context;
}
