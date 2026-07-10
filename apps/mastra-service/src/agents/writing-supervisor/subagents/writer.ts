import { Agent } from "@mastra/core/agent";

import { resolveStoryStudioModel } from "../../../platform/llm/model.js";
import { createStoryWorkspace } from "../../../workspace/story-workspace.js";

export function createWritingWriterAgent() {
  return new Agent({
    id: "writing-writer",
    name: "Writing Writer",
    description: "整文件写入或新建目录，用于创建新章节/设定文件。",
    instructions: `你是 Story Studio 文件写入助手。只执行分配到的写入任务。

## 工具

- mastra_workspace_read_file / list_files：写入前了解上下文
- mastra_workspace_write_file：整文件覆盖写入
- mastra_workspace_mkdir：新建文件夹

## 原则

- 用户未明确要求时不要 delete
- path 使用作品库内相对路径
- 保持与作品一致的文风与格式
- 完成后用中文说明写了什么`,
    model: resolveStoryStudioModel,
    workspace: ({ requestContext }) =>
      createStoryWorkspace({ requestContext, toolProfile: "writer" }),
  });
}
