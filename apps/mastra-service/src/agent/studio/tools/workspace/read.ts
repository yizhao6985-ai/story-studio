import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  exploreWorkWorkspace,
  globWorkWorkspace,
  grepWorkWorkspace,
  listWorkFileTree,
  readWorkWorkspaceFile,
} from "@story-studio/workspace-fs";

import { requireWorkPath } from "../../../platform/work-path.js";

const MAX_TREE_ENTRIES = 200;

type FlatEntry = { path: string; kind: "file" | "directory" };

function flattenWorkspaceTree(
  entries: Array<{ path: string; kind: "file" | "directory"; children?: unknown[] }>,
): FlatEntry[] {
  const out: FlatEntry[] = [];

  const walk = (
    nodes: Array<{ path: string; kind: "file" | "directory"; children?: unknown[] }>,
  ) => {
    for (const node of nodes) {
      out.push({ path: node.path, kind: node.kind });
      if (Array.isArray(node.children) && node.children.length) {
        walk(
          node.children as Array<{
            path: string;
            kind: "file" | "directory";
            children?: unknown[];
          }>,
        );
      }
    }
  };

  walk(entries);
  return out;
}

export function createReadTools() {
  return {
    list_workspace_tree: createTool({
      id: "list_workspace_tree",
      description:
        "列出作品库完整目录树（全部文件夹与文本文件路径）。首次了解结构时用；条目过多时会截断。",
      inputSchema: z.object({}),
      execute: async (_input, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        const tree = await listWorkFileTree(workPath);
        const entries = flattenWorkspaceTree(tree);
        if (entries.length <= MAX_TREE_ENTRIES) {
          return { entries, truncated: false };
        }
        return {
          entries: entries.slice(0, MAX_TREE_ENTRIES),
          truncated: true,
          totalEntries: entries.length,
        };
      },
    }),
    list_workspace_dir: createTool({
      id: "list_workspace_dir",
      description:
        "列出指定文件夹的直接子项（仅一层）。path 为空表示作品根目录；查看子文件夹需逐层调用。",
      inputSchema: z.object({ path: z.string().optional() }),
      execute: async ({ path }, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        return exploreWorkWorkspace(workPath, path ?? "");
      },
    }),
    glob_workspace: createTool({
      id: "glob_workspace",
      description:
        "按 glob 模式查找文本文件路径，如 **/*.md、chapters/*.txt。最多返回 50 条，超出时 truncated 为 true。",
      inputSchema: z.object({ pattern: z.string() }),
      execute: async ({ pattern }, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        return globWorkWorkspace(workPath, pattern);
      },
    }),
    grep_workspace: createTool({
      id: "grep_workspace",
      description:
        "在文本文件内容中搜索关键词或正则，返回匹配行号与上下文。最多 30 条；pathPrefix 可限定子目录。",
      inputSchema: z.object({
        query: z.string(),
        pathPrefix: z.string().optional(),
        useRegex: z.boolean().optional(),
      }),
      execute: async ({ query, pathPrefix, useRegex }, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        return grepWorkWorkspace({
          workPath,
          query,
          pathPrefix,
          useRegex,
        });
      },
    }),
    read_workspace_file: createTool({
      id: "read_workspace_file",
      description:
        "读取文本文件内容（.md/.txt/.yaml/.json 等）。默认最多 200 行；大文件请用 startLine/endLine 读片段。",
      inputSchema: z.object({
        path: z.string(),
        startLine: z.number().int().min(1).optional(),
        endLine: z.number().int().min(1).optional(),
      }),
      execute: async ({ path, startLine, endLine }, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        return readWorkWorkspaceFile(workPath, path, { startLine, endLine });
      },
    }),
  };
}
