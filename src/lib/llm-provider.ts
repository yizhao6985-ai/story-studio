const PROVIDER_LABELS: [match: RegExp, label: string][] = [
  [/dashscope/i, "百炼"],
  [/openai\.com/i, "OpenAI"],
  [/anthropic/i, "Anthropic"],
  [/deepseek/i, "DeepSeek"],
  [/moonshot/i, "Moonshot"],
  [/zhipu/i, "智谱"],
];

export function getLlmProviderLabel(baseUrl: string): string {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    for (const [match, label] of PROVIDER_LABELS) {
      if (match.test(hostname)) return label;
    }
    const segment = hostname.replace(/^www\./, "").split(".")[0];
    return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : "AI";
  } catch {
    return "AI";
  }
}
