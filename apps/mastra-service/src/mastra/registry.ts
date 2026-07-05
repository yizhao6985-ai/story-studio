import { Mastra, type Config } from "@mastra/core";

type MastraServerConfig = NonNullable<Config["server"]>;

import { createStudioMemory } from "../agent/studio/memory.js";
import { getStudioObservability } from "../agent/studio/observability.js";
import { createSupervisorAgent } from "../agent/studio/agents/supervisor.js";
import { getStudioStorage } from "../agent/studio/storage.js";

let studioMastra: Mastra | null = null;

export function createStudioMastra(server?: MastraServerConfig): Mastra {
  const storage = getStudioStorage();
  const memory = createStudioMemory(storage);
  const storySupervisor = createSupervisorAgent(memory);

  return new Mastra({
    storage,
    observability: getStudioObservability(),
    memory: { studio: memory },
    agents: { storySupervisor },
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
