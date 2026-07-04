import { useCallback, useEffect, useState } from "react";

import { LLM_STATUS_CHANGED_EVENT } from "@/lib/llm-status-events";

export function useLlmConfigured() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const status = await window.storyStudio.settings.getLlmStatus();
    setConfigured(status.configured);
    return status.configured;
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => {
      void refresh();
    };
    window.addEventListener(LLM_STATUS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(LLM_STATUS_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { configured, refresh, setConfigured };
}
