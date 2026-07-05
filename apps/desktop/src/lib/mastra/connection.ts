const DEFAULT_MASTRA_URL = "http://localhost:4111";

/** Mastra dev 端口被占用时会递增；与 index.html connect-src 允许范围一致。 */
const MASTRA_PROBE_HOSTS = ["localhost", "127.0.0.1"] as const;
const MASTRA_PROBE_PORTS = [4111, 4112, 4113, 4114, 4115] as const;

let cachedApiBase: string | null = null;
let runtimeRegistered = false;

function getMastraBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_MASTRA_URL?.trim();
  return (fromEnv || DEFAULT_MASTRA_URL).replace(/\/$/, "");
}

function getApiBaseCandidates(): string[] {
  const fromEnv = import.meta.env.VITE_MASTRA_URL?.trim();
  if (fromEnv) {
    return [fromEnv.replace(/\/$/, "")];
  }

  const candidates = new Set<string>();
  for (const host of MASTRA_PROBE_HOSTS) {
    for (const port of MASTRA_PROBE_PORTS) {
      candidates.add(`http://${host}:${port}`);
    }
  }

  // 显式配置优先，便于覆盖自动探测
  candidates.add(getMastraBaseUrl());
  return [...candidates];
}

async function discoverMastraApiBase(): Promise<string> {
  const candidates = getApiBaseCandidates();
  const started = Date.now();

  while (Date.now() - started < 60_000) {
    for (const candidate of candidates) {
      try {
        const response = await fetch(`${candidate}/studio/health`);
        if (response.ok) return candidate;
      } catch {
        // try next candidate
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error("MASTRA_SERVICE_UNREACHABLE");
}

async function registerRuntimeWithMastra(apiBase: string): Promise<void> {
  const userDataRoot = await window.storyStudio.app.getUserDataPath();
  const response = await fetch(`${apiBase}/studio/runtime/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userDataRoot }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "MASTRA_RUNTIME_REGISTER_FAILED");
  }
  runtimeRegistered = true;
}

/** 前端直连 Mastra：探测 API 地址并注册 Electron userData。 */
export async function getMastraApiBase(): Promise<string> {
  if (cachedApiBase) return cachedApiBase;

  const apiBase = await discoverMastraApiBase();
  if (!runtimeRegistered) {
    await registerRuntimeWithMastra(apiBase);
  }

  cachedApiBase = apiBase;
  return apiBase;
}

export function resetMastraApiBaseCache(): void {
  cachedApiBase = null;
  runtimeRegistered = false;
}
