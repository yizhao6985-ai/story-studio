import { useCallback, useEffect, useState } from "react";

import { getLlmProviderLabel } from "@/lib/llm-provider";
import { LLM_STATUS_CHANGED_EVENT, notifyLlmStatusChanged } from "@/lib/llm-status-events";

type LlmPreferencesState = {
  providerLabel: string;
  chatModel: string;
  chatModels: { id: string; label: string }[];
  modelsError?: string;
};

export function useLlmPreferences() {
  const [preferences, setPreferences] = useState<LlmPreferencesState | null>(null);

  const refresh = useCallback(async () => {
    const prefs = await window.storyStudio.settings.getLlmPreferences();
    if (!prefs.configured) {
      setPreferences(null);
      return;
    }

    setPreferences({
      providerLabel: getLlmProviderLabel(prefs.baseUrl),
      chatModel: prefs.chatModel,
      chatModels: prefs.chatModels,
      modelsError: prefs.modelsError,
    });
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => {
      void refresh();
    };
    window.addEventListener(LLM_STATUS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(LLM_STATUS_CHANGED_EVENT, onChange);
  }, [refresh]);

  const setChatModel = useCallback(
    async (modelId: string) => {
      await window.storyStudio.settings.setChatModel(modelId);
      notifyLlmStatusChanged();
      await refresh();
    },
    [refresh],
  );

  return { preferences, setChatModel };
}
