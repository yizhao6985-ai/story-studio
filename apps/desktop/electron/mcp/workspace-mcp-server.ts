import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import { createServer } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { validateMcpAuthHeader } from "./mcp-auth.js";
import {
  assertAbsoluteWorkPath,
  mcpRequestContext,
} from "./request-context.js";
import {
  handleEditFile,
  handleDeleteFile,
  handleFileStat,
  handleGrep,
  handleListFiles,
  handleMkdir,
  handleReadFile,
  handleWriteFile,
} from "./workspace-tool-handlers.js";

export const MCP_PORT = 3100;
export const MCP_PATH = "/mcp";
export const WORK_PATH_HEADER = "x-story-studio-work-path";

const transports: Record<string, StreamableHTTPServerTransport> = {};

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "story-studio-workspace",
    version: "1.0.0",
  });

  server.registerTool(
    "list_files",
    {
      description: "列出作品目录树，可用 pattern 过滤路径",
      inputSchema: {
        pattern: z.string().optional().describe("可选 glob 风格路径过滤"),
      },
    },
    async ({ pattern }) => ({
      content: [{ type: "text", text: await handleListFiles(pattern) }],
    }),
  );

  server.registerTool(
    "grep",
    {
      description: "在作品文本文件中搜索内容",
      inputSchema: {
        query: z.string().describe("搜索关键词"),
        pathPattern: z
          .string()
          .optional()
          .describe("可选路径过滤，如 chapters/**"),
      },
    },
    async ({ query, pathPattern }) => ({
      content: [{ type: "text", text: await handleGrep(query, pathPattern) }],
    }),
  );

  server.registerTool(
    "read_file",
    {
      description: "读取作品文本文件（大文件用 startLine/endLine 分页）",
      inputSchema: {
        path: z.string().describe("作品库内相对路径"),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
      },
    },
    async ({ path, startLine, endLine }) => ({
      content: [
        {
          type: "text",
          text: await handleReadFile({ path, startLine, endLine }),
        },
      ],
    }),
  );

  server.registerTool(
    "file_stat",
    {
      description: "查看文件或目录元信息",
      inputSchema: {
        path: z.string().describe("作品库内相对路径"),
      },
    },
    async ({ path }) => ({
      content: [{ type: "text", text: await handleFileStat(path) }],
    }),
  );

  server.registerTool(
    "edit_file",
    {
      description: "局部精确替换（old_string 须与磁盘完全一致）",
      inputSchema: {
        path: z.string(),
        old_string: z.string(),
        new_string: z.string(),
      },
    },
    async (input) => ({
      content: [{ type: "text", text: await handleEditFile(input) }],
    }),
  );

  server.registerTool(
    "write_file",
    {
      description: "整文件写入或覆盖",
      inputSchema: {
        path: z.string(),
        content: z.string(),
      },
    },
    async (input) => ({
      content: [{ type: "text", text: await handleWriteFile(input) }],
    }),
  );

  server.registerTool(
    "mkdir",
    {
      description: "新建文件夹",
      inputSchema: {
        path: z.string(),
      },
    },
    async ({ path }) => ({
      content: [{ type: "text", text: await handleMkdir(path) }],
    }),
  );

  server.registerTool(
    "delete_file",
    {
      description: "删除作品库内的文件或目录（不可恢复，仅用于明确的删除任务）",
      inputSchema: {
        path: z.string().describe("作品库内相对路径"),
      },
    },
    async ({ path }) => ({
      content: [{ type: "text", text: await handleDeleteFile(path) }],
    }),
  );

  return server;
}

function readWorkPathHeader(req: IncomingMessage): string | null {
  const raw = req.headers[WORK_PATH_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.trim()) return null;
  try {
    return assertAbsoluteWorkPath(value);
  } catch {
    return null;
  }
}

function rejectUnauthorized(res: import("node:http").ServerResponse): void {
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "UNAUTHORIZED" }));
}

function rejectMissingWorkPath(res: import("node:http").ServerResponse): void {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "WORK_PATH_REQUIRED" }));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw) as unknown;
}

let httpServer: HttpServer | null = null;

export async function startWorkspaceMcpServer(): Promise<void> {
  if (httpServer) return;

  httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

    if (url.pathname !== MCP_PATH) {
      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, service: "story-studio-mcp" }));
        return;
      }
      res.writeHead(404).end("Not Found");
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type, mcp-session-id, authorization, x-story-studio-work-path",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");

    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    if (!validateMcpAuthHeader(req.headers.authorization)) {
      rejectUnauthorized(res);
      return;
    }

    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (req.method === "POST") {
        const body = await readJsonBody(req);
        const isInit = !sessionId && isInitializeRequest(body);

        if (!isInit) {
          const workPath = readWorkPathHeader(req);
          if (!workPath) {
            rejectMissingWorkPath(res);
            return;
          }

          await mcpRequestContext.run({ workPath }, async () => {
            if (!sessionId || !transports[sessionId]) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  error: {
                    code: -32000,
                    message: "Invalid or missing session ID",
                  },
                  id: null,
                }),
              );
              return;
            }

            await transports[sessionId]!.handleRequest(req, res, body);
          });
          return;
        }

        await mcpRequestContext.run({ workPath: null }, async () => {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
              transports[id] = transport;
            },
          });

          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
            }
          };

          const server = createMcpServer();
          await server.connect(transport);
          await transport.handleRequest(req, res, body);
        });
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        const workPath = readWorkPathHeader(req);
        if (!workPath) {
          rejectMissingWorkPath(res);
          return;
        }

        if (!sessionId || !transports[sessionId]) {
          res.writeHead(400).end("Invalid or missing session ID");
          return;
        }

        await mcpRequestContext.run({ workPath }, async () => {
          await transports[sessionId]!.handleRequest(req, res);
        });
        return;
      }

      res.writeHead(405).end("Method Not Allowed");
    } catch (error) {
      console.error("[story-studio-mcp]", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          }),
        );
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer!.once("error", reject);
    httpServer!.listen(MCP_PORT, "127.0.0.1", () => resolve());
  });

  console.log(
    `[story-studio-mcp] listening on http://127.0.0.1:${MCP_PORT}${MCP_PATH}`,
  );
}

export async function stopWorkspaceMcpServer(): Promise<void> {
  for (const sessionId of Object.keys(transports)) {
    try {
      await transports[sessionId]?.close();
    } catch {
      // ignore
    }
    delete transports[sessionId];
  }

  if (!httpServer) return;

  await new Promise<void>((resolve) => {
    httpServer!.close(() => resolve());
  });
  httpServer = null;
}

export async function probeMcpHealth(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${MCP_PORT}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
