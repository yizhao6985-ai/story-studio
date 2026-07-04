import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

import { workCheckpointPath, workDataKey } from "../../library/work-data-dir.js";
import {
  createSqliteCheckpointer,
  evictCheckpointer,
} from "../graph/checkpointer.js";
import { createGraph } from "../graph/workflow.js";

type CompiledWorkGraph = Awaited<ReturnType<typeof createGraph>>;

type WorkGraphEntry = {
  graph: CompiledWorkGraph;
  checkpointer: BaseCheckpointSaver;
};

const workGraphs = new Map<string, WorkGraphEntry>();

async function getWorkGraphEntry(workPath: string): Promise<WorkGraphEntry> {
  const key = workDataKey(workPath);
  let entry = workGraphs.get(key);
  if (!entry) {
    const checkpointer = createSqliteCheckpointer(workCheckpointPath(workPath));
    const graph = await createGraph(checkpointer);
    entry = { graph, checkpointer };
    workGraphs.set(key, entry);
  }
  return entry;
}

export async function getWorkGraph(workPath: string): Promise<CompiledWorkGraph> {
  return (await getWorkGraphEntry(workPath)).graph;
}

export async function deleteWorkThread(
  workPath: string,
  threadId: string,
): Promise<void> {
  const { checkpointer } = await getWorkGraphEntry(workPath);
  if (typeof checkpointer.deleteThread !== "function") return;
  await checkpointer.deleteThread(threadId);
}

function evictWorkGraph(workPath: string): void {
  workGraphs.delete(workDataKey(workPath));
}

/** 释放作品相关的内存缓存与数据库连接，便于删除 userData */
export function releaseWorkAgent(workPath: string): void {
  evictWorkGraph(workPath);
  evictCheckpointer(workCheckpointPath(workPath));
}
