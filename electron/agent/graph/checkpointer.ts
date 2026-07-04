import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
const savers = new Map<string, BaseCheckpointSaver>();
let sqliteWarningLogged = false;

function logSqliteFallback(error: unknown) {
  if (sqliteWarningLogged) return;
  sqliteWarningLogged = true;
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(
    "[checkpointer] SQLite checkpoint unavailable; using in-memory checkpoints.",
    "Conversation state will not persist across restarts.",
    detail,
  );
}

function createPersistentCheckpointer(dbPath: string): BaseCheckpointSaver {
  mkdirSync(dirname(dbPath), { recursive: true });
  require("better-sqlite3");
  const { SqliteSaver } = require("@langchain/langgraph-checkpoint-sqlite") as typeof import("@langchain/langgraph-checkpoint-sqlite");
  return SqliteSaver.fromConnString(dbPath);
}

export function createSqliteCheckpointer(dbPath: string): BaseCheckpointSaver {
  let saver = savers.get(dbPath);
  if (!saver) {
    try {
      saver = createPersistentCheckpointer(dbPath);
    } catch (error) {
      logSqliteFallback(error);
      saver = new MemorySaver();
    }
    savers.set(dbPath, saver);
  }
  return saver;
}

export function evictCheckpointer(dbPath: string): void {
  const saver = savers.get(dbPath);
  if (saver && "db" in saver) {
    const db = (saver as { db?: { close?: () => void } }).db;
    try {
      db?.close?.();
    } catch {
      /* ignore close errors */
    }
  }
  savers.delete(dbPath);
}
