import { readWorkUserMeta } from "@story-studio/workspace-fs";

import { buildOrUpdateWorkContext } from "./indexer.js";
import { formatFileIndex, rankFilesByQuery } from "./retrieval.js";
import { loadWorkContext } from "./store.js";
import type { RelevantContext, WorkContext } from "./types.js";

const buildInFlight = new Map<string, Promise<WorkContext>>();

async function ensureWorkContext(workPath: string): Promise<WorkContext> {
  const existing = await loadWorkContext(workPath);
  const meta = await readWorkUserMeta(workPath);
  const revision = meta.revision ?? 0;

  if (existing && existing.revision === revision) {
    return existing;
  }

  const pending = buildInFlight.get(workPath);
  if (pending) return pending;

  const promise = buildOrUpdateWorkContext(workPath, existing).finally(() => {
    buildInFlight.delete(workPath);
  });
  buildInFlight.set(workPath, promise);
  return promise;
}

export async function getRelevantContext(input: {
  workPath: string;
  query: string;
}): Promise<RelevantContext> {
  const context = await ensureWorkContext(input.workPath);
  const relevantFiles = rankFilesByQuery(context.files, input.query);

  return {
    workBrief: context.workBrief,
    relevantFiles,
    fileIndex: formatFileIndex(context.files),
  };
}

export async function warmWorkContext(workPath: string): Promise<void> {
  await ensureWorkContext(workPath);
}
