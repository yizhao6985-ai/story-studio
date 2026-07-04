import { Button } from "@/components/ui/button";
import { AppChrome } from "@/features/app-chrome";
import { useLlmSettingsForm } from "@/hooks/settings/use-llm-settings-form";

import { LlmSettingsForm } from "../settings/llm-settings-form";

type SetupScreenProps = {
  onComplete: () => void;
};

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const { apiKey, setApiKey, baseUrl, setBaseUrl, error, loading, handleSave } =
    useLlmSettingsForm({ mode: "initial", onSuccess: onComplete });

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppChrome trailing={<span className="app-region-no-drag text-[13px] text-muted-foreground">初始配置</span>} />
      <div className="surface-glass flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <p className="text-xs text-muted-foreground">Story Studio · AI 辅助创作工具</p>
          </div>
          <div className="surface-elevated rounded-none border border-border p-5">
            <h2 className="text-[15px] font-medium">配置 AI 服务</h2>
            <p className="mt-1.5 mb-5 text-xs leading-relaxed text-muted-foreground">
              需要 OpenAI 兼容的 API 才能运行。填写 API Key 与 Base URL 后即可开始。
            </p>

            <LlmSettingsForm
              apiKey={apiKey}
              baseUrl={baseUrl}
              onApiKeyChange={setApiKey}
              onBaseUrlChange={setBaseUrl}
            />

            {error && (
              <p className="mt-3 text-xs leading-relaxed text-destructive">{error}</p>
            )}

            <div className="mt-5 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={loading}>
                {loading ? "验证中…" : "保存并继续"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
