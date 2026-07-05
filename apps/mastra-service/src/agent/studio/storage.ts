import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MastraCompositeStore } from "@mastra/core/storage";
import { DuckDBStore } from "@mastra/duckdb";
import { LibSQLStore } from "@mastra/libsql";

import {
  studioAgentDbPath,
  studioObservabilityDbPath,
} from "@story-studio/shared/paths";
import { getUserDataRoot } from "../platform/llm/env.js";

type StudioStorageBundle = {
  composite: MastraCompositeStore;
  libsql: LibSQLStore;
  duckdb: DuckDBStore;
};

let studioStorage: StudioStorageBundle | null = null;

let shutdownHooksRegistered = false;

const STORE_CLOSE_RETRIES = 5;
const STORE_CLOSE_RETRY_DELAY_MS = 400;
/** 关闭前等待锁释放；默认 5s 在 dev 停止时经常不够。 */
const STORE_CONNECTION_TIMEOUT_MS = 30_000;

type LibSQLClient = {
  closed: boolean;
  protocol: string;
  execute: (sql: string) => Promise<unknown>;
  close: () => void;
};

function patchStoreClose(store: LibSQLStore): void {
  const client = (store as unknown as { client: LibSQLClient }).client;

  store.close = async () => {
    if (client.closed) return;

    const isLocalFileDb = client.protocol === "file";
    if (isLocalFileDb) {
      for (let attempt = 0; attempt < STORE_CLOSE_RETRIES; attempt++) {
        try {
          await client.execute("PRAGMA wal_checkpoint(TRUNCATE);");
          await client.execute("PRAGMA journal_mode=DELETE;");
          break;
        } catch (err) {
          if (attempt >= STORE_CLOSE_RETRIES - 1) {
            console.warn(
              "LibSQLStore: Failed to checkpoint WAL before close.",
              err,
            );
          } else {
            await new Promise((resolve) =>
              setTimeout(resolve, STORE_CLOSE_RETRY_DELAY_MS * (attempt + 1)),
            );
          }
        }
      }
    }
    client.close();
  };
}

function resolveObservabilityDbPath(filePath: string): string {
  // mastra dev 热重载会直接 kill 子进程，文件型 DuckDB 锁来不及释放。
  if (process.env.MASTRA_DEV === "true") {
    return ":memory:";
  }
  const override = process.env.STORY_STUDIO_OBSERVABILITY_DB?.trim();
  if (override) return override;
  return filePath;
}

function createStudioStorageBundle(): StudioStorageBundle {
  const userDataRoot = getUserDataRoot();
  const agentDbPath = studioAgentDbPath(userDataRoot);
  const observabilityDbPath = resolveObservabilityDbPath(
    studioObservabilityDbPath(userDataRoot),
  );

  mkdirSync(dirname(agentDbPath), { recursive: true });

  const libsql = new LibSQLStore({
    id: `story-studio-${agentDbPath}`,
    url: `file:${agentDbPath}`,
    connectionTimeoutMs: STORE_CONNECTION_TIMEOUT_MS,
  });
  patchStoreClose(libsql);

  const duckdb = new DuckDBStore({
    id: `story-studio-observability-${observabilityDbPath}`,
    path: observabilityDbPath,
  });

  const composite = new MastraCompositeStore({
    id: `story-studio-composite-${agentDbPath}`,
    default: libsql,
    domains: {
      observability: duckdb.observability,
    },
  });

  return { composite, libsql, duckdb };
}

export function getStudioStorage(): MastraCompositeStore {
  if (!studioStorage) {
    studioStorage = createStudioStorageBundle();
  }
  return studioStorage.composite;
}

async function closeStudioStorageBundle(
  bundle: StudioStorageBundle,
): Promise<void> {
  await bundle.composite.close?.();
  await bundle.libsql.close?.();
  await bundle.duckdb.close();
}

export async function closeStudioStorage(): Promise<void> {
  if (!studioStorage) return;
  const bundle = studioStorage;
  studioStorage = null;
  await closeStudioStorageBundle(bundle);
}

export function registerWorkStorageShutdownHooks(): void {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const onShutdown = () => {
    void closeStudioStorage();
  };

  process.once("SIGINT", onShutdown);
  process.once("SIGTERM", onShutdown);
  process.once("beforeExit", onShutdown);
}
