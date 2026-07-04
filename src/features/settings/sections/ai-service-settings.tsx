import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLlmSettingsForm } from "@/hooks/settings/use-llm-settings-form";

import {
  SettingsGroup,
  SettingsPage,
  SettingsRow,
} from "../settings-primitives";

export function AiServiceSettings() {
  const {
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
  } = useLlmSettingsForm({ mode: "update" });

  return (
    <SettingsPage
      title="AI 服务"
      description="配置 OpenAI 兼容 API，用于对话与创作辅助。"
    >
      <SettingsGroup title="连接">
        <SettingsRow
          label="API Key"
          description="留空则保持当前 Key 不变。"
          htmlFor="settings-api-key"
          align="start"
        >
          <Input
            id="settings-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            className="h-7 w-[220px] text-[11px]"
          />
        </SettingsRow>

        <SettingsRow
          label="API Base URL"
          description="OpenAI 兼容服务的 Base URL。"
          htmlFor="settings-base-url"
          align="start"
        >
          <Input
            id="settings-base-url"
            type="url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://..."
            autoComplete="off"
            className="h-7 w-[220px] text-[11px]"
          />
        </SettingsRow>
      </SettingsGroup>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        文生图等功能需百炼原生 API，使用非百炼端点时可能不可用。
      </p>

      {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}
      {success ? <p className="px-1 text-xs text-success">{success}</p> : null}

      <div className="flex flex-wrap items-center gap-2 px-1">
        <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={loading}>
          {loading ? "验证中…" : "保存"}
        </Button>
        {configured ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void handleClear()}
            disabled={loading}
          >
            移除当前设置
          </Button>
        ) : null}
      </div>
    </SettingsPage>
  );
}
