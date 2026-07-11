import { randomBytes } from "node:crypto";

let mcpAuthToken: string | null = null;
let devFallbackEnabled = false;

const DEV_FALLBACK_TOKEN = "dev-local-token";

export function configureMcpAuth(options: { devFallback?: boolean }): void {
  devFallbackEnabled = options.devFallback ?? false;
}

export function initializeMcpAuthToken(): string {
  const fromEnv = process.env.STORY_STUDIO_MCP_TOKEN?.trim();
  if (fromEnv) {
    mcpAuthToken = fromEnv;
    return mcpAuthToken;
  }

  if (devFallbackEnabled) {
    mcpAuthToken = DEV_FALLBACK_TOKEN;
    return mcpAuthToken;
  }

  mcpAuthToken = randomBytes(32).toString("hex");
  return mcpAuthToken;
}

export function getMcpAuthToken(): string {
  if (!mcpAuthToken) {
    return initializeMcpAuthToken();
  }
  return mcpAuthToken;
}

export function validateMcpAuthHeader(
  authorization: string | string[] | undefined,
): boolean {
  const token = getMcpAuthToken();
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!header?.startsWith("Bearer ")) return false;
  return header.slice("Bearer ".length) === token;
}

export function getDevFallbackMcpToken(): string {
  return DEV_FALLBACK_TOKEN;
}
