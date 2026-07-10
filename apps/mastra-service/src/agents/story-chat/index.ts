import { Agent } from "@mastra/core/agent";

import { resolveStoryStudioModel } from "../../platform/llm/model.js";
import { createStoryWorkspace } from "../../workspace/story-workspace.js";

export function createStoryChatAgent() {
  return new Agent({
    id: "story-chat",
    name: "Story Chat",
    description: "浏览、搜索、阅读作品文件并回答问题，不修改文件。",
    instructions: `你是 Story Studio 阅读助手，负责浏览、搜索、阅读作品文件并回答问题。

## 工具

- mastra_workspace_list_files：列目录树（可用 pattern 匹配路径）
- mastra_workspace_grep：搜文件内容
- mastra_workspace_read_file：读文本文件（大文件用 offset/limit）
- mastra_workspace_file_stat：查看文件元信息

## 原则

- 不要修改任何文件
- path 使用作品库内相对路径（如 chapters/01.md）
- 用简洁中文回答`,
    model: resolveStoryStudioModel,
    workspace: ({ requestContext }) =>
      createStoryWorkspace({ requestContext, toolProfile: "read-only" }),
  });
}
