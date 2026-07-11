import type { StructuredToolInterface } from "@langchain/core/tools";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

import {
  requireWorkPathFromConfig,
  WORK_PATH_HEADER,
} from "./work-path.js";

export type McpToolProfile = "read-only" | "editor" | "writer";

const READ_ONLY = new Set([
  "list_files",
  "grep",
  "read_file",
  "file_stat",
]);

const EDITOR = new Set([...READ_ONLY, "edit_file"]);
const WRITER = new Set([...EDITOR, "write_file", "mkdir", "delete_file"]);

let client: MultiServerMCPClient | null = null;

function getMcpUrl(): string {
  return (
    process.env.STORY_STUDIO_MCP_URL?.trim() || "http://127.0.0.1:3100/mcp"
  );
}

function getMcpAuthToken(): string | undefined {
  const fromEnv = process.env.STORY_STUDIO_MCP_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") return "dev-local-token";
  return undefined;
}

function getMcpAuthHeaders(): Record<string, string> | undefined {
  const token = getMcpAuthToken();
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
}

export function getMcpClient(): MultiServerMCPClient {
  if (!client) {
    const authHeaders = getMcpAuthHeaders();
    client = new MultiServerMCPClient({
      throwOnLoadError: true,
      onConnectionError: "throw",
      beforeToolCall: (toolCallRequest, _state, config) => {
        const workPath = requireWorkPathFromConfig(config);
        return {
          headers: {
            ...authHeaders,
            [WORK_PATH_HEADER]: workPath,
          },
          args: toolCallRequest.args,
        };
      },
      mcpServers: {
        storyStudio: {
          transport: "http",
          url: getMcpUrl(),
          headers: authHeaders,
        },
      },
    });
  }
  return client;
}

function filterToolsByProfile(
  tools: StructuredToolInterface[],
  profile: McpToolProfile,
): StructuredToolInterface[] {
  const allowed =
    profile === "read-only"
      ? READ_ONLY
      : profile === "editor"
        ? EDITOR
        : WRITER;

  return tools.filter((tool) => allowed.has(tool.name));
}

export async function loadMcpTools(
  profile: McpToolProfile,
): Promise<StructuredToolInterface[]> {
  const allTools = await getMcpClient().getTools();
  return filterToolsByProfile(allTools, profile);
}
