import { useCallback, useEffect, useState } from "react";

import { LLM_STATUS_CHANGED_EVENT, notifyLlmStatusChanged } from "@/lib/llm-status-events";
import { formatLlmErrorMessage } from "@/lib/api-error-message";

type UseLlmSettingsFormOptions = {
  mode: "initial" | "update";
  onSuccess?: () => void;
};

export function useLlmSettingsForm({ mode, onSuccess }: UseLlmSettingsFormOptions) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    const status = await window.storyStudio.settings.getLlmStatus();
    setBaseUrl(status.baseUrl);
    setConfigured(status.configured);
  }, []);

  useEffect(() => {
    if (mode === "update") {
      void loadStatus();
    }
  }, [mode, loadStatus]);

  useEffect(() => {
    if (mode !== "update") return;
    const onChange = () => {
      void loadStatus();
    };
    window.addEventListener(LLM_STATUS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(LLM_STATUS_CHANGED_EVENT, onChange);
  }, [mode, loadStatus]);

  const handleSave = useCallback(async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const trimmedBaseUrl = baseUrl.trim();

      if (mode === "initial") {
        await window.storyStudio.settings.saveLlm({
          apiKey: apiKey.trim(),
          baseUrl: trimmedBaseUrl,
        });
      } else {
        await window.storyStudio.settings.updateLlm({
          apiKey: apiKey.trim() || undefined,
          baseUrl: trimmedBaseUrl || undefined,
        });
      }

      const validation = await window.storyStudio.settings.validateLlm();
      if (!validation.ok) {
        setError(validation.message ?? "API 连接验证失败，请检查 Key 与 Base URL");
        return;
      }

      if (mode === "update") {
        setApiKey("");
        setSuccess("设置已保存");
        setConfigured(true);
      }
      notifyLlmStatusChanged();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("API_KEY_REQUIRED")) {
        setError("请填写 API Key");
      } else if (message.includes("BASE_URL_REQUIRED")) {
        setError("请填写 API Base URL");
      } else if (message.includes("NO_CHAT_MODELS_AVAILABLE")) {
        setError("未能获取可用对话模型，请检查 Base URL 是否支持 /models 接口");
      } else if (message.includes("SAFE_STORAGE_UNAVAILABLE")) {
        setError("系统密钥链不可用，无法安全保存 API Key");
      } else {
        setError(formatLlmErrorMessage(message));
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey, baseUrl, mode, onSuccess]);

  const handleClear = useCallback(async () => {
    if (
      !window.confirm("确定要移除当前 AI 服务配置吗？移除后需重新填写 API Key。")
    ) {
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await window.storyStudio.settings.clearLlm();
      setApiKey("");
      setBaseUrl("");
      setConfigured(false);
      notifyLlmStatusChanged();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "移除失败");
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return {
    apiKey,
    setApiKey,
    baseUrl,
    setBaseUrl,
    configured,
    error,
    success,
    loading,
    handleSave,
    handleClear,
  };
}
