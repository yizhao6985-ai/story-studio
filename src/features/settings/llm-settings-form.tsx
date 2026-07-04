import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LlmSettingsFormProps = {
  apiKey: string;
  baseUrl: string;
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  apiKeyRequired?: boolean;
  apiKeyPlaceholder?: string;
  baseUrlRequired?: boolean;
};

export function LlmSettingsForm({
  apiKey,
  baseUrl,
  onApiKeyChange,
  onBaseUrlChange,
  apiKeyRequired = true,
  apiKeyPlaceholder = "sk-...",
  baseUrlRequired = true,
}: LlmSettingsFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="api-key">
          API Key{apiKeyRequired ? " *" : "（留空则不修改）"}
        </Label>
        <Input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={apiKeyPlaceholder}
          autoComplete="off"
          required={apiKeyRequired}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="base-url">
          API Base URL（OpenAI 兼容）{baseUrlRequired ? " *" : "（留空则不修改）"}
        </Label>
        <Input
          id="base-url"
          type="url"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder="https://..."
          autoComplete="off"
          required={baseUrlRequired}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          填写 OpenAI 兼容服务的 Base URL。文生图等功能需百炼原生 API，使用非百炼端点时可能不可用。
        </p>
      </div>
    </div>
  );
}
