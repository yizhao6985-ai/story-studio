import { Agent } from "@mastra/core/agent";

import { resolveStoryStudioModel } from "../../../platform/llm/model.js";
import { createStoryWorkspace } from "../../../workspace/story-workspace.js";

export function createWritingEditorAgent() {
  return new Agent({
    id: "writing-editor",
    name: "Writing Editor",
    description: "对作品文件做局部精确替换，不整文件覆盖。",
    instructions: `你是 Story Studio 局部编辑助手。只执行分配到的编辑任务。

## 工具

- mastra_workspace_read_file / grep：编辑前确认片段
- mastra_workspace_edit_file：局部精确替换（old_string 须与磁盘完全一致）

## 原则

- 只改任务范围内的内容
- path 使用作品库内相对路径
- 完成后用中文说明改了什么`,
    model: resolveStoryStudioModel,
    workspace: ({ requestContext }) =>
      createStoryWorkspace({ requestContext, toolProfile: "editor" }),
  });
}
