import { Agent } from "@mastra/core/agent";
import type { SubAgent } from "@mastra/core/agent";

import { resolveStoryStudioModel } from "../../platform/llm/model.js";
import { createStoryWorkspace } from "../../workspace/story-workspace.js";
import { writingSupervisorDelegation } from "./delegation.js";
import { createWritingEditorAgent } from "./subagents/editor.js";
import { createWritingExplorerAgent } from "./subagents/explorer.js";
import { createWritingVerifierAgent } from "./subagents/verifier.js";
import { createWritingWriterAgent } from "./subagents/writer.js";

export function createWritingSupervisorAgent() {
  const explorer = createWritingExplorerAgent();
  const editor = createWritingEditorAgent();
  const writer = createWritingWriterAgent();
  const verifier = createWritingVerifierAgent();

  return new Agent({
    id: "writing-supervisor",
    name: "Writing Supervisor",
    description:
      "协调写作子 Agent 完成文件修改，接收任务简报而非完整对话历史。",
    instructions: `你是 Story Studio 写作协调者（Writing Supervisor）。
根据任务简报委派子 Agent 完成文件修改：

- explorer：定位与阅读相关文件
- editor：局部精确编辑（edit_file）
- writer：整文件写入或新建目录
- verifier：校验改动是否符合任务

## 原则

- 只执行当前任务简报中的目标
- 委派时给出清晰、可执行的子任务描述
- 汇总子 Agent 结果为简洁中文，不要重复冗长工具输出
- 返回 changedFiles（改动路径列表）与 changeSummary（改动摘要）
- path 使用作品库内相对路径`,
    model: resolveStoryStudioModel,
    workspace: ({ requestContext }) =>
      createStoryWorkspace({ requestContext, toolProfile: "none" }),
    agents: () => {
      const agents: Record<string, SubAgent> = {
        explorer,
        editor,
        writer,
        verifier,
      };
      return agents;
    },
    defaultOptions: {
      maxSteps: 20,
      delegation: writingSupervisorDelegation,
    },
  });
}
