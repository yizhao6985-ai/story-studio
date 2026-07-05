import type { StructuredToolInterface } from "@langchain/core/tools";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import {
  createWorkWorkspaceFile,
  deleteWorkWorkspaceEntry,
  exploreWorkWorkspace,
  globWorkWorkspace,
  grepWorkWorkspace,
  patchWorkWorkspaceFile,
  readWorkWorkspaceFile,
  renameWorkWorkspaceEntry,
  writeWorkWorkspaceFile,
} from "../../library/index.js";

import { TOOL_NAMES } from "../shared/work-loop/tool-gate.js";

export function createWorkspaceTools(workPath: string): StructuredToolInterface[] {
  return [
    tool(
      async (input) => {
        const entries = await exploreWorkWorkspace(workPath, input.path ?? "");
        return JSON.stringify({
          ok: true,
          tool: TOOL_NAMES.explore,
          summary: `${entries.length} entries`,
          data: { path: input.path ?? "", entries },
        });
      },
      {
        name: TOOL_NAMES.explore,
        description:
          "列出作品目录下一层内容（文件与文件夹）。path 为空表示根目录；查看子目录时传入相对路径。",
        schema: z.object({
          path: z
            .string()
            .optional()
            .describe("相对作品根目录的路径，默认根目录"),
        }),
      },
    ),
    tool(
      async (input) => {
        const result = await globWorkWorkspace(workPath, input.pattern);
        return JSON.stringify({
          ok: true,
          tool: TOOL_NAMES.glob,
          summary: `${result.paths.length} paths${result.truncated ? " (truncated)" : ""}`,
          data: result,
          truncated: result.truncated,
          hint: result.truncated ? "请收窄 glob pattern" : undefined,
        });
      },
      {
        name: TOOL_NAMES.glob,
        description: "按 glob 模式匹配文件路径，如 **/*.md、scripts/ep-*.md",
        schema: z.object({
          pattern: z.string().describe("glob 模式"),
        }),
      },
    ),
    tool(
      async (input) => {
        const result = await grepWorkWorkspace({
          workPath,
          query: input.query,
          pathPrefix: input.pathPrefix,
          useRegex: input.useRegex,
        });
        return JSON.stringify({
          ok: true,
          tool: TOOL_NAMES.grep,
          summary: `${result.matches.length} matches in ${result.filesScanned} files`,
          data: result,
          truncated: result.truncated,
          hint: result.truncated
            ? "命中过多，请缩小范围或用 read_workspace_file"
            : undefined,
        });
      },
      {
        name: TOOL_NAMES.grep,
        description: "在作品文本文件中搜索关键词或正则",
        schema: z.object({
          query: z.string().describe("搜索词或正则"),
          pathPrefix: z
            .string()
            .optional()
            .describe("限定搜索的子目录，如 scripts"),
          useRegex: z.boolean().optional().describe("是否按正则匹配"),
        }),
      },
    ),
    tool(
      async (input) => {
        const file = await readWorkWorkspaceFile(workPath, input.path, {
          startLine: input.startLine,
          endLine: input.endLine,
        });
        return JSON.stringify({
          ok: file.readable,
          tool: TOOL_NAMES.read,
          summary: file.readable
            ? `lines ${file.startLine}-${file.endLine} of ${file.totalLines}`
            : "not readable",
          data: file,
          truncated: file.hasMore,
          hint: file.hasMore
            ? `继续 read path=${input.path} startLine=${file.endLine + 1}`
            : undefined,
        });
      },
      {
        name: TOOL_NAMES.read,
        description: "读取作品内单个文本文件，支持按行范围读取大文件",
        schema: z.object({
          path: z.string().describe("相对作品根目录的文件路径"),
          startLine: z.number().int().min(1).optional(),
          endLine: z.number().int().min(1).optional(),
        }),
      },
    ),
    tool(
      async (input) => {
        return JSON.stringify({
          ok: true,
          tool: TOOL_NAMES.pin,
          summary: `pinned ${input.path} (${input.action})`,
          data: input,
        });
      },
      {
        name: TOOL_NAMES.pin,
        description:
          "写入前定位目标：登记将要修改、新建、重命名或删除的路径。overwrite/patch/delete/rename 须先 read 源路径；create 用于新文件。",
        schema: z.object({
          path: z.string().describe("相对作品根目录的路径（rename 时为原路径 fromPath）"),
          action: z.enum(["patch", "overwrite", "create", "delete", "rename"]),
          reason: z.string().optional().describe("为何选此路径"),
        }),
      },
    ),
    tool(
      async (input) => {
        const result = await patchWorkWorkspaceFile(
          workPath,
          input.path,
          input.oldText,
          input.newText,
        );
        if (!result.replaced) {
          return JSON.stringify({
            ok: false,
            tool: TOOL_NAMES.patch,
            summary: "oldText 未找到",
            code: "PATCH_MISS",
            data: result,
          });
        }
        const preview = input.newText.slice(0, 300);
        return JSON.stringify({
          ok: true,
          tool: TOOL_NAMES.patch,
          summary: `patched ${input.path}`,
          data: { path: input.path, occurrences: result.occurrences, preview },
        });
      },
      {
        name: TOOL_NAMES.patch,
        description: "在已读文件中替换 oldText 为 newText（须先 pin 且 read）",
        schema: z.object({
          path: z.string(),
          oldText: z.string(),
          newText: z.string(),
        }),
      },
    ),
    tool(
      async (input) => {
        await writeWorkWorkspaceFile(workPath, input.path, input.content);
        return JSON.stringify({
          ok: true,
          tool: TOOL_NAMES.write,
          summary: `wrote ${input.path}`,
          data: {
            path: input.path,
            bytes: input.content.length,
            preview: input.content.slice(0, 300),
          },
        });
      },
      {
        name: TOOL_NAMES.write,
        description: "覆盖写入整个文件（须先 pin 且 read；大改优先 patch）",
        schema: z.object({
          path: z.string(),
          content: z.string(),
        }),
      },
    ),
    tool(
      async (input) => {
        await createWorkWorkspaceFile(workPath, input.path, input.content ?? "");
        const content = input.content ?? "";
        return JSON.stringify({
          ok: true,
          tool: TOOL_NAMES.create,
          summary: `created ${input.path}`,
          data: {
            path: input.path,
            bytes: content.length,
            preview: content.slice(0, 300),
          },
        });
      },
      {
        name: TOOL_NAMES.create,
        description: "新建文件（须先 pin action=create；已存在请用 write/patch）",
        schema: z.object({
          path: z.string(),
          content: z.string().optional(),
        }),
      },
    ),
    tool(
      async (input) => {
        await deleteWorkWorkspaceEntry(workPath, input.path);
        return JSON.stringify({
          ok: true,
          tool: TOOL_NAMES.delete,
          summary: `deleted ${input.path}`,
          data: { path: input.path },
        });
      },
      {
        name: TOOL_NAMES.delete,
        description:
          "删除作品内文件或空目录（须先 pin action=delete，且已 read 或 explore 确认路径）",
        schema: z.object({
          path: z.string().describe("相对作品根目录的路径"),
        }),
      },
    ),
    tool(
      async (input) => {
        await renameWorkWorkspaceEntry(
          workPath,
          input.fromPath,
          input.toPath,
        );
        return JSON.stringify({
          ok: true,
          tool: TOOL_NAMES.rename,
          summary: `renamed ${input.fromPath} → ${input.toPath}`,
          data: { fromPath: input.fromPath, toPath: input.toPath },
        });
      },
      {
        name: TOOL_NAMES.rename,
        description:
          "重命名或移动文件/目录（须先 pin action=rename 定位 fromPath，且已 read 或 explore 确认原路径）",
        schema: z.object({
          fromPath: z.string().describe("原相对路径"),
          toPath: z.string().describe("新相对路径"),
        }),
      },
    ),
  ];
}
