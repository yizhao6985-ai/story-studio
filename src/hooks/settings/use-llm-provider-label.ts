import { useCallback, useEffect, useState } from "react";

import { getLlmProviderLabel } from "@/lib/llm-provider";
import { LLM_STATUS_CHANGED_EVENT } from "@/lib/llm-status-events";

export function useLlmProviderLabel() {
  const [label, setLabel] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const status = await window.storyStudio.settings.getLlmStatus();
    if (!status.configured) {
      setLabel(null);
      return;
    }
    setLabel(getLlmProviderLabel(status.baseUrl));
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => {
      void refresh();
    };
    window.addEventListener(LLM_STATUS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(LLM_STATUS_CHANGED_EVENT, onChange);
  }, [refresh]);

  return label;
}
