export type ChatModelOption = { id: string; label: string };

/** 非纯文本模型：embedding、语音、图像/视频生成、视觉/多模态等 */
const NON_TEXT_MODEL_PATTERNS = [
  /embed/i,
  /embedding/i,
  /rerank/i,
  /tts/i,
  /asr/i,
  /speech/i,
  /audio/i,
  /sambert/i,
  /paraformer/i,
  /cosyvoice/i,
  /recognition/i,
  /synthesis/i,
  /wanx/i,
  /\bwan[-_]/i,
  /flux/i,
  /dall-e/i,
  /image/i,
  /cogview/i,
  /cogvideo/i,
  /stable-diffusion/i,
  /midjourney/i,
  /[-_]vl[-_.]/i,
  /[-_]vl$/i,
  /^vl[-_]/i,
  /qwen-vl/i,
  /qwen2-vl/i,
  /qwen3-vl/i,
  /qvq/i,
  /omni/i,
  /realtime/i,
  /vision/i,
  /multimodal/i,
  /video/i,
  /mllm/i,
  /whisper/i,
  /moderation/i,
  /ocr/i,
  /translate/i,
  /layout/i,
  /detection/i,
  /segment/i,
  /glm-4v/i,
  /glm-4\.5v/i,
];

type ModelsApiResponse = {
  data?: Array<{ id?: string; created?: number }>;
};

type ModelSortEntry = { id: string; created?: number };

const MODEL_FAMILY_RULES: Array<[RegExp, string]> = [
  [/^deepseek/, "deepseek"],
  [/^qwq/, "qwq"],
  [/^qwen/, "qwen"],
  [/^glm/, "glm"],
  [/^kimi/, "kimi"],
  [/^moonshot/, "moonshot"],
  [/^minimax/, "minimax"],
  [/^gpt[-_]/, "gpt"],
  [/^claude/, "claude"],
  [/^llama/, "llama"],
];

function resolveModelFamily(modelId: string): string {
  const id = modelId.toLowerCase();
  for (const [pattern, family] of MODEL_FAMILY_RULES) {
    if (pattern.test(id)) return family;
  }
  return id.match(/^([a-z]+)/)?.[1] ?? id;
}

function inferModelNewnessScore(modelId: string): number {
  const id = modelId.toLowerCase();
  let score = 0;

  for (const part of id.match(/\d+(?:\.\d+)*/g) ?? []) {
    score = score * 1_000 + Math.floor(parseFloat(part) * 100);
  }

  if (/\blatest\b/.test(id)) score += 500_000;
  if (/\bmax\b/.test(id)) score += 80_000;
  if (/\bplus\b/.test(id)) score += 50_000;
  if (/\bflash\b/.test(id)) score += 20_000;
  if (/\bturbo\b/.test(id)) score += 10_000;

  return score;
}

function resolveModelNewness(entry: ModelSortEntry): number {
  if (entry.created && entry.created > 0) return entry.created;
  return inferModelNewnessScore(entry.id);
}

function sortTextChatModels(entries: ModelSortEntry[]): string[] {
  return [...entries]
    .sort((a, b) => {
      const familyCmp = resolveModelFamily(a.id).localeCompare(
        resolveModelFamily(b.id),
      );
      if (familyCmp !== 0) return familyCmp;

      const newnessCmp = resolveModelNewness(b) - resolveModelNewness(a);
      if (newnessCmp !== 0) return newnessCmp;

      return a.id.localeCompare(b.id);
    })
    .map((entry) => entry.id);
}

function isTextChatModel(modelId: string): boolean {
  const id = modelId.trim();
  if (!id) return false;
  return !NON_TEXT_MODEL_PATTERNS.some((pattern) => pattern.test(id));
}

function formatChatModelLabel(modelId: string): string {
  return modelId
    .split(/[-_/]/)
    .filter(Boolean)
    .map((part) => {
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export async function fetchChatModelsFromApi(
  apiKey: string,
  baseUrl: string,
): Promise<ChatModelOption[]> {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const response = await fetch(`${normalizedBase}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `MODELS_FETCH_FAILED: ${response.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
    );
  }

  const payload = (await response.json()) as ModelsApiResponse;
  const entries = (payload.data ?? [])
    .map((item) => ({
      id: item.id?.trim() ?? "",
      created: typeof item.created === "number" ? item.created : undefined,
    }))
    .filter((item) => item.id.length > 0 && isTextChatModel(item.id));

  const uniqueEntries = new Map<string, ModelSortEntry>();
  for (const entry of entries) {
    const existing = uniqueEntries.get(entry.id);
    if (!existing || (entry.created ?? 0) > (existing.created ?? 0)) {
      uniqueEntries.set(entry.id, entry);
    }
  }

  const sortedIds = sortTextChatModels([...uniqueEntries.values()]);

  return sortedIds.map((id) => ({
    id,
    label: formatChatModelLabel(id),
  }));
}
