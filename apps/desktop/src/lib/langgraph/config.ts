const DEFAULT_LANGGRAPH_URL = "http://127.0.0.1:2024";

let cachedApiUrl: string | null = null;

async function probeLangGraph(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/ok`);
    return response.ok;
  } catch {
    try {
      const health = await fetch(`${baseUrl}/health`);
      return health.ok;
    } catch {
      return false;
    }
  }
}

async function probeMcpHealth(): Promise<boolean> {
  try {
    const response = await fetch("http://127.0.0.1:3100/health");
    return response.ok;
  } catch {
    return false;
  }
}

export type ServiceHealth = {
  mcp: boolean;
  langgraph: boolean;
  langgraphUrl: string | null;
};

export async function waitForAgentServices(): Promise<ServiceHealth> {
  if (window.storyStudio?.studio?.waitForServices) {
    const status = await window.storyStudio.studio.waitForServices();
    return {
      mcp: status.mcp.ok,
      langgraph: status.langgraph.ok,
      langgraphUrl: status.langgraph.url,
    };
  }

  const started = Date.now();
  while (Date.now() - started < 60_000) {
    const mcp = await probeMcpHealth();
    const langgraphUrl = DEFAULT_LANGGRAPH_URL;
    const langgraph = await probeLangGraph(langgraphUrl);
    if (mcp && langgraph) {
      return { mcp, langgraph, langgraphUrl };
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error("AGENT_SERVICES_UNREACHABLE");
}

export async function discoverLangGraphApiUrl(): Promise<string> {
  if (cachedApiUrl) return cachedApiUrl;

  const fromIpc = await window.storyStudio.studio.getLangGraphApiUrl?.();
  if (fromIpc && (await probeLangGraph(fromIpc))) {
    cachedApiUrl = fromIpc.replace(/\/$/, "");
    return cachedApiUrl;
  }

  const fromEnv = import.meta.env.VITE_LANGGRAPH_API_URL?.trim();
  const candidates = fromEnv
    ? [fromEnv.replace(/\/$/, "")]
    : [
        DEFAULT_LANGGRAPH_URL,
        "http://localhost:2024",
        "http://127.0.0.1:8123",
      ];

  const health = await waitForAgentServices().catch(() => null);
  if (health?.langgraphUrl) {
    cachedApiUrl = health.langgraphUrl.replace(/\/$/, "");
    return cachedApiUrl;
  }

  const started = Date.now();
  while (Date.now() - started < 60_000) {
    for (const candidate of candidates) {
      if (await probeLangGraph(candidate)) {
        cachedApiUrl = candidate;
        return candidate;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error("LANGGRAPH_API_UNREACHABLE");
}

export function resetLangGraphApiCache(): void {
  cachedApiUrl = null;
}

export function assistantIdForMode(_mode: "ask" | "normal"): string {
  return "story-studio";
}
