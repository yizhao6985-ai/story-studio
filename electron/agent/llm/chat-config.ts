/**
 * 百炼 Chat 模型族差异：kwargs 配置。
 */
type DashScopeChatFamily = "qwen" | "glm" | "omni";

type DashScopeChatScenario = "stream" | "structured";

const USAGE_STREAM_OPTIONS = {
  stream_options: { include_usage: true },
} as const;

export function resolveDashScopeChatFamily(
  modelId: string,
): DashScopeChatFamily {
  const normalized = modelId.toLowerCase();
  if (normalized.includes("omni")) return "omni";
  if (normalized.startsWith("glm") || normalized.includes("/glm")) {
    return "glm";
  }
  return "qwen";
}

export function getDashScopeChatKwargs(
  family: DashScopeChatFamily,
  scenario: DashScopeChatScenario,
): Record<string, unknown> {
  const base = {
    enable_thinking: false,
    ...USAGE_STREAM_OPTIONS,
  };

  switch (family) {
    case "qwen":
      return { ...base, incremental_output: true };
    case "glm":
      return scenario === "stream" ? { ...base, tool_stream: true } : base;
    case "omni":
      return {
        ...base,
        modalities: ["text"],
      };
  }
}
