import { Agent } from "@mastra/core/agent";

import { resolveStoryStudioModel } from "../../../platform/llm/model.js";
import { createStoryWorkspace } from "../../../workspace/story-workspace.js";

export function createWritingVerifierAgent() {
  return new Agent({
    id: "writing-verifier",
    name: "Writing Verifier",
    description: "校验改动是否符合任务要求，只读不写。",
    instructions: `你是 Story Studio 改动校验助手。根据任务与已改文件，检查改动是否合理。

## 工具

- mastra_workspace_read_file / grep / file_stat

## 输出

用中文说明：
- 是否通过校验（passed）
- 发现的问题列表（issues）
- 补充说明（notes）

不要修改任何文件。`,
    model: resolveStoryStudioModel,
    workspace: ({ requestContext }) =>
      createStoryWorkspace({ requestContext, toolProfile: "read-only" }),
  });
}
