import type { WorkFileSummary } from "./types.js";

const STOP_WORDS = new Set([
  "的",
  "了",
  "是",
  "在",
  "和",
  "与",
  "或",
  "我",
  "你",
  "他",
  "她",
  "它",
  "这",
  "那",
  "什么",
  "怎么",
  "如何",
  "为什么",
  "the",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "for",
  "and",
  "or",
]);

function tokenizeQuery(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const tokens = normalized
    .split(/[\s,，。！？!?;；:：/\\|]+/)
    .flatMap((part) => part.match(/[\u4e00-\u9fff]+|[a-z0-9_-]+/gi) ?? [])
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  return [...new Set(tokens)];
}

function scoreFile(file: WorkFileSummary, tokens: string[]): number {
  if (tokens.length === 0) return 0;

  const pathLower = file.path.toLowerCase();
  const summaryLower = file.summary.toLowerCase();
  const kindLower = file.kind.toLowerCase();
  const entities = (file.entities ?? []).map((entity) => entity.toLowerCase());

  let score = 0;

  for (const token of tokens) {
    if (pathLower.includes(token)) score += 4;
    if (summaryLower.includes(token)) score += 3;
    if (kindLower.includes(token)) score += 2;
    for (const entity of entities) {
      if (entity.includes(token) || token.includes(entity)) {
        score += 6;
      }
    }
  }

  return score;
}

export function rankFilesByQuery(
  files: WorkFileSummary[],
  query: string,
  limit = 8,
): WorkFileSummary[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return files.slice(0, limit);
  }

  return [...files]
    .map((file) => ({ file, score: scoreFile(file, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path, "zh-CN"))
    .slice(0, limit)
    .map((entry) => entry.file);
}

export function formatFileIndex(files: WorkFileSummary[]): string[] {
  return files.map((file) => `- ${file.path} (${file.kind}): ${file.summary}`);
}
