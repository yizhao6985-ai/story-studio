import { Mastra, type Config } from "@mastra/core";

type MastraServerConfig = NonNullable<Config["server"]>;

import { createStoryChatAgent } from "../agents/story-chat/index.js";
import { createStorySupervisorAgent } from "../agents/story-supervisor/index.js";
import { createWritingPlannerAgent } from "../agents/writing-planner/index.js";
import { createWritingSupervisorAgent } from "../agents/writing-supervisor/index.js";
import { createWritingEditorAgent } from "../agents/writing-supervisor/subagents/editor.js";
import { createWritingExplorerAgent } from "../agents/writing-supervisor/subagents/explorer.js";
import { createWritingVerifierAgent } from "../agents/writing-supervisor/subagents/verifier.js";
import { createWritingWriterAgent } from "../agents/writing-supervisor/subagents/writer.js";
import { createStudioMemory } from "../memory/studio-memory.js";
import { getStudioObservability } from "../observability/studio-observability.js";
import { getStudioStorage } from "../storage/studio-storage.js";
import { createWritingWorkflow } from "../workflows/writing/index.js";

let studioMastra: Mastra | null = null;

export function createStudioMastra(server?: MastraServerConfig): Mastra {
  const storage = getStudioStorage();
  const memory = createStudioMemory(storage);
  const writingWorkflow = createWritingWorkflow();

  const storyChat = createStoryChatAgent();
  const writingPlanner = createWritingPlannerAgent();
  const writingExplorer = createWritingExplorerAgent();
  const writingEditor = createWritingEditorAgent();
  const writingWriter = createWritingWriterAgent();
  const writingVerifier = createWritingVerifierAgent();
  const writingSupervisor = createWritingSupervisorAgent();
  const storySupervisor = createStorySupervisorAgent(memory, writingWorkflow);

  return new Mastra({
    storage,
    observability: getStudioObservability(),
    memory: { studio: memory },
    agents: {
      storySupervisor,
      storyChat,
      writingPlanner,
      writingExplorer,
      writingEditor,
      writingWriter,
      writingVerifier,
      writingSupervisor,
    },
    workflows: {
      writing: writingWorkflow,
    },
    ...(server ? { server } : {}),
  });
}

/** 全局唯一 Mastra 实例；作品隔离靠 Memory resourceId（workPath）。 */
export function getStudioMastra(): Mastra {
  if (!studioMastra) {
    studioMastra = createStudioMastra();
  }
  return studioMastra;
}

export function initStudioMastra(server: MastraServerConfig): Mastra {
  if (!studioMastra) {
    studioMastra = createStudioMastra(server);
  }
  return studioMastra;
}

/** 保留 API 兼容；单实例模式下无需按作品 evict。 */
export async function evictStudioMastra(_workPath: string): Promise<void> {
  // no-op
}
