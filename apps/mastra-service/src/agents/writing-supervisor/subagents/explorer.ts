import { Agent } from "@mastra/core/agent";

import { resolveStoryStudioModel } from "../../../platform/llm/model.js";
import { createStoryWorkspace } from "../../../workspace/story-workspace.js";

export function createWritingExplorerAgent() {
  return new Agent({
    id: "writing-explorer",
    name: "Writing Explorer",
    description: "定位并阅读作品文件，返回结构化摘要，不修改文件。",
    instructions: `你是 Story Studio 文件探索助手。根据任务在作品库中定位并阅读相关文件。

## 工具

- mastra_workspace_list_files / grep / read_file / file_stat

## 输出

用中文汇总：
- 每个相关文件的路径
- 与任务相关的摘要
- 必要时附关键摘录

不要修改文件。path 使用作品库内相对路径。`,
    model: resolveStoryStudioModel,
    workspace: ({ requestContext }) =>
      createStoryWorkspace({ requestContext, toolProfile: "read-only" }),
  });
}
