import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

import { getMcpAuthToken } from "./mcp/mcp-auth.js";
import { MCP_PORT, probeMcpHealth } from "./mcp/workspace-mcp-server.js";

const DEFAULT_LANGGRAPH_PORT = 2024;
const DEFAULT_LANGGRAPH_HOST = "localhost";
const LANGGRAPH_PROBE_TIMEOUT_MS = 90_000;

export type AgentServiceStatus = {
  mcp: { ok: boolean; url: string };
  langgraph: { ok: boolean; url: string | null; embedded: boolean };
};

let langgraphProcess: ChildProcess | null = null;
let langgraphApiUrl: string | null = null;
let langgraphPort = DEFAULT_LANGGRAPH_PORT;

function repoLanggraphServiceDir(): string {
  const electronDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(electronDir, "../../langgraph-service"),
    resolve(electronDir, "../../../apps/langgraph-service"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "langgraph.json"))) return dir;
  }
  return candidates[0];
}

function langgraphCliPath(serviceDir: string): string {
  return join(serviceDir, "node_modules/.bin/langgraphjs");
}

async function loadLanggraphEnv(serviceDir: string): Promise<Record<string, string>> {
  const envPath = join(serviceDir, ".env");
  if (!existsSync(envPath)) return {};
  const raw = await readFile(envPath, "utf8");
  const parsed = parseDotEnv(raw);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

async function probeLangGraph(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/ok`);
    if (response.ok) return true;
    const health = await fetch(`${baseUrl}/health`);
    return health.ok;
  } catch {
    return false;
  }
}

async function waitForLangGraph(baseUrl: string): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < LANGGRAPH_PROBE_TIMEOUT_MS) {
    if (await probeLangGraph(baseUrl)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 400));
  }
  return false;
}

function shouldEmbedLangGraph(): boolean {
  if (process.env.STORY_STUDIO_SKIP_EMBEDDED_LANGGRAPH === "1") {
    return false;
  }
  return true;
}

export async function startEmbeddedLangGraph(options: {
  userDataPath: string;
  mcpToken: string;
}): Promise<string | null> {
  if (!shouldEmbedLangGraph()) {
    langgraphApiUrl = `http://${DEFAULT_LANGGRAPH_HOST}:${DEFAULT_LANGGRAPH_PORT}`;
    if (await waitForLangGraph(langgraphApiUrl)) {
      return langgraphApiUrl;
    }
    return null;
  }

  langgraphApiUrl = `http://${DEFAULT_LANGGRAPH_HOST}:${DEFAULT_LANGGRAPH_PORT}`;
  if (await probeLangGraph(langgraphApiUrl)) {
    return langgraphApiUrl;
  }

  if (langgraphProcess) {
    return langgraphApiUrl;
  }

  const serviceDir = repoLanggraphServiceDir();
  const cli = langgraphCliPath(serviceDir);
  if (!existsSync(cli)) {
    console.warn("[story-studio] langgraph CLI not found; skipping embedded agent");
    langgraphApiUrl = `http://${DEFAULT_LANGGRAPH_HOST}:${DEFAULT_LANGGRAPH_PORT}`;
    return (await waitForLangGraph(langgraphApiUrl)) ? langgraphApiUrl : null;
  }

  const runtimeDir = join(options.userDataPath, "langgraph-runtime");
  await mkdir(runtimeDir, { recursive: true });

  const fileEnv = await loadLanggraphEnv(serviceDir);
  langgraphPort = DEFAULT_LANGGRAPH_PORT;
  langgraphApiUrl = `http://${DEFAULT_LANGGRAPH_HOST}:${langgraphPort}`;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...fileEnv,
    BROWSER: "none",
    STORY_STUDIO_MCP_URL: `http://127.0.0.1:${MCP_PORT}/mcp`,
    STORY_STUDIO_MCP_TOKEN: options.mcpToken,
    STORY_STUDIO_USER_DATA: options.userDataPath,
    LANGGRAPH_RUNTIME_DIR: runtimeDir,
  };

  langgraphProcess = spawn(
    cli,
    ["dev", "-c", "langgraph.json", "--no-browser", "-p", String(langgraphPort)],
    {
      cwd: serviceDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  langgraphProcess.stdout?.on("data", (chunk: Buffer) => {
    console.log(`[langgraph] ${chunk.toString().trimEnd()}`);
  });
  langgraphProcess.stderr?.on("data", (chunk: Buffer) => {
    console.error(`[langgraph] ${chunk.toString().trimEnd()}`);
  });
  langgraphProcess.on("exit", (code) => {
    console.warn(`[langgraph] exited with code ${code ?? "unknown"}`);
    langgraphProcess = null;
  });

  const ready = await waitForLangGraph(langgraphApiUrl);
  return ready ? langgraphApiUrl : null;
}

export async function stopEmbeddedLangGraph(): Promise<void> {
  if (!langgraphProcess) return;
  langgraphProcess.kill("SIGTERM");
  langgraphProcess = null;
  langgraphApiUrl = null;
}

export function getLangGraphApiUrl(): string | null {
  return langgraphApiUrl;
}

export async function getAgentServiceStatus(): Promise<AgentServiceStatus> {
  const mcpUrl = `http://127.0.0.1:${MCP_PORT}`;
  const mcpOk = await probeMcpHealth();
  const url = langgraphApiUrl ?? `http://${DEFAULT_LANGGRAPH_HOST}:${DEFAULT_LANGGRAPH_PORT}`;
  const langgraphOk = await probeLangGraph(url);

  return {
    mcp: { ok: mcpOk, url: mcpUrl },
    langgraph: {
      ok: langgraphOk,
      url: langgraphOk ? url : null,
      embedded: langgraphProcess != null,
    },
  };
}

export async function initializeAgentServices(userDataPath: string): Promise<void> {
  const mcpToken = getMcpAuthToken();
  await startEmbeddedLangGraph({
    userDataPath,
    mcpToken,
  });
}
