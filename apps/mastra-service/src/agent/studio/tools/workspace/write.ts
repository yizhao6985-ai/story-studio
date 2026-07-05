import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  createWorkWorkspaceDirectory,
  createWorkWorkspaceFile,
  deleteWorkWorkspaceEntry,
  patchWorkWorkspaceFile,
  renameWorkWorkspaceEntry,
  writeWorkWorkspaceFile,
} from "@story-studio/workspace-fs";

import { requireWorkPath } from "../../../platform/work-path.js";

export function createWriteTools() {
  return {
    patch_workspace_file: createTool({
      id: "patch_workspace_file",
      description:
        "精确替换文件中与 oldText 完全匹配（含空白与换行）的片段。未匹配时不修改。",
      inputSchema: z.object({
        path: z.string(),
        oldText: z.string(),
        newText: z.string(),
      }),
      execute: async ({ path, oldText, newText }, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        return patchWorkWorkspaceFile(workPath, path, oldText, newText);
      },
    }),
    write_workspace_file: createTool({
      id: "write_workspace_file",
      description: "覆盖写入整个文件；父目录不存在时会自动创建。",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        await writeWorkWorkspaceFile(workPath, path, content);
        return { path, bytes: content.length };
      },
    }),
    create_workspace_file: createTool({
      id: "create_workspace_file",
      description: "新建文本文件；目标已存在时会失败。",
      inputSchema: z.object({
        path: z.string(),
        content: z.string().optional(),
      }),
      execute: async ({ path, content }, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        await createWorkWorkspaceFile(workPath, path, content ?? "");
        return { path };
      },
    }),
    create_workspace_directory: createTool({
      id: "create_workspace_directory",
      description:
        "新建空文件夹；目标已存在时会失败。文件夹名须为 ASCII（建议小写英文与连字符）。",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        await createWorkWorkspaceDirectory(workPath, path);
        return { path };
      },
    }),
    delete_workspace_entry: createTool({
      id: "delete_workspace_entry",
      description: "删除文件或空目录；非空目录需先清空内容。",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        await deleteWorkWorkspaceEntry(workPath, path);
        return { path };
      },
    }),
    rename_workspace_entry: createTool({
      id: "rename_workspace_entry",
      description: "重命名或移动文件/文件夹。",
      inputSchema: z.object({ fromPath: z.string(), toPath: z.string() }),
      execute: async ({ fromPath, toPath }, { requestContext }) => {
        const workPath = requireWorkPath(requestContext);
        await renameWorkWorkspaceEntry(workPath, fromPath, toPath);
        return { fromPath, toPath };
      },
    }),
  };
}
