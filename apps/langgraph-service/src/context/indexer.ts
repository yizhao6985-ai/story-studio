import { z } from "zod";

import {
  getWorkFileRevision,
  listWorkTextFilePaths,
  readWorkUserMeta,
  readWorkWorkspaceFile,
} from "@story-studio/workspace-fs";

import { generateStructuredOutput } from "../llm/structured-output.js";
import { createChatModel } from "../platform/llm.js";

import { saveWorkContext } from "./store.js";
import type { WorkContext, WorkFileKind, WorkFileSummary } from "./types.js";

const BATCH_SIZE = 4;
const MAX_CONTENT_CHARS = 6000;

const fileSummarySchema = z.object({
  path: z.string(),
  kind: z.enum(["chapter", "character", "setting", "outline", "note", "other"]),
  summary: z.string(),
  entities: z.array(z.string()).nullable(),
});

const batchSummarySchema = z.object({
  files: z.array(fileSummarySchema),
});

const workBriefSchema = z.object({
  workBrief: z.string(),
});

function inferKindFromPath(path: string): WorkFileKind {
  const lower = path.toLowerCase();
  if (/(^|\/)readme\.md$/i.test(lower)) return "note";
  if (/(character|人物|角色)/i.test(lower)) return "character";
  if (/(chapter|章节|chapters)/i.test(lower)) return "chapter";
  if (/(setting|设定|世界观|world)/i.test(lower)) return "setting";
  if (/(outline|大纲|plot)/i.test(lower)) return "outline";
  if (/(note|笔记|memo)/i.test(lower)) return "note";
  return "other";
}

async function summarizeBatch(
  entries: Array<{ path: string; content: string; kind: WorkFileKind }>,
): Promise<WorkFileSummary[]> {
  if (entries.length === 0) return [];

  const model = createChatModel({ temperature: 0.2 });
  const listing = entries
    .map(
      (entry) =>
        `### ${entry.path}（建议类型：${entry.kind}）\n${entry.content.slice(0, MAX_CONTENT_CHARS)}`,
    )
    .join("\n\n");

  const result = await generateStructuredOutput(
    model,
    `请为以下作品文本文件生成摘要。每个文件输出 kind、summary、entities（涉及的人物/地点/概念，可选）。

${listing}`,
    batchSummarySchema,
    "你是 Story Studio 作品索引助手。为创作作品文件生成简洁中文摘要，便于后续对话理解作品内容。",
    { name: "batch_summary" },
  );

  const byPath = new Map(result.files.map((file) => [file.path, file]));

  return entries.map((entry) => {
    const generated = byPath.get(entry.path);
    return {
      path: entry.path,
      hash: "",
      kind: generated?.kind ?? entry.kind,
      summary: generated?.summary?.trim() || `文本文件：${entry.path}`,
      entities: generated?.entities?.filter(Boolean) ?? undefined,
    };
  });
}

async function generateWorkBrief(files: WorkFileSummary[]): Promise<string> {
  if (files.length === 0) {
    return "当前作品库暂无文本文件。";
  }

  const model = createChatModel({ temperature: 0.2 });
  const listing = files
    .map(
      (file) =>
        `- ${file.path} (${file.kind}): ${file.summary}${
          file.entities?.length ? `；涉及：${file.entities.join("、")}` : ""
        }`,
    )
    .join("\n");

  const result = await generateStructuredOutput(
    model,
    `根据以下作品文件摘要，生成一段 150~300 字的中文作品概览，说明题材、主线、主要人物/设定（如有）。

${listing}`,
    workBriefSchema,
    "你是 Story Studio 作品概览助手。只输出 workBrief 字段。",
    { name: "work_brief" },
  );

  return result.workBrief.trim() || "作品库包含多个文本文件，详见各文件摘要。";
}

export async function buildOrUpdateWorkContext(
  workPath: string,
  existing: WorkContext | null,
): Promise<WorkContext> {
  const meta = await readWorkUserMeta(workPath);
  const revision = meta.revision ?? 0;
  const paths = await listWorkTextFilePaths(workPath);

  const existingByPath = new Map(
    (existing?.files ?? []).map((file) => [file.path, file]),
  );

  const toSummarize: Array<{
    path: string;
    content: string;
    kind: WorkFileKind;
  }> = [];
  const nextFiles: WorkFileSummary[] = [];

  for (const path of paths) {
    const hash = await getWorkFileRevision(workPath, path);
    const cached = existingByPath.get(path);
    if (cached && cached.hash === hash) {
      nextFiles.push(cached);
      continue;
    }

    const readResult = await readWorkWorkspaceFile(workPath, path);
    if (!readResult.readable) continue;

    toSummarize.push({
      path,
      content: readResult.content,
      kind: cached?.kind ?? inferKindFromPath(path),
    });
  }

  for (let index = 0; index < toSummarize.length; index += BATCH_SIZE) {
    const batch = toSummarize.slice(index, index + BATCH_SIZE);
    const summaries = await summarizeBatch(batch);
    for (const summary of summaries) {
      const hash = await getWorkFileRevision(workPath, summary.path);
      nextFiles.push({ ...summary, hash });
    }
  }

  nextFiles.sort((a, b) => a.path.localeCompare(b.path, "zh-CN"));

  const filesChanged =
    !existing ||
    existing.revision !== revision ||
    existing.files.length !== nextFiles.length ||
    toSummarize.length > 0;

  const workBrief = filesChanged
    ? await generateWorkBrief(nextFiles)
    : existing.workBrief;

  const context: WorkContext = {
    workPath,
    revision,
    generatedAt: new Date().toISOString(),
    workBrief,
    files: nextFiles,
  };

  await saveWorkContext(context);
  return context;
}
