import { Agent } from "@mastra/core/agent";

import { resolveStoryStudioModel } from "../../platform/llm/model.js";
import { createReadTools } from "../tools/workspace/index.js";

export function createChatAgent() {
  return new Agent({
    id: "story-chat",
    name: "Story Chat",
    description: "浏览、搜索、阅读作品文件并回答问题，不修改文件。",
    instructions: `你是 Story Studio 阅读助手，负责浏览、搜索、阅读作品文件并回答问题。

## 工具

- list_workspace_tree：查看完整目录结构
- list_workspace_dir：查看某文件夹下一层
- glob_workspace：按路径模式找文件
- grep_workspace：搜文件内容
- read_workspace_file：读文本文件（大文件用 startLine/endLine）

## 原则

- 不要修改任何文件
- 用简洁中文回答`,
    model: resolveStoryStudioModel,
    tools: createReadTools(),
  });
}
