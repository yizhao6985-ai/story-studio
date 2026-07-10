import { Agent } from "@mastra/core/agent";
import type { SubAgent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";

import type { AnyWorkflow } from "@mastra/core/workflows";

import { resolveStoryStudioModel } from "../../platform/llm/model.js";
import { createStoryWorkspace } from "../../workspace/story-workspace.js";
import { createStoryChatAgent } from "../story-chat/index.js";
import { storySupervisorDelegation } from "./delegation.js";

export function createStorySupervisorAgent(
  memory: Memory,
  writingWorkflow: AnyWorkflow,
) {
  const chat = createStoryChatAgent();

  return new Agent({
    id: "story-supervisor",
    name: "Story Supervisor",
    instructions: `你是 Story Studio 总协调者（Supervisor）。
根据用户意图把任务委派给合适的子能力：

- story-chat（chat）：问答、阅读、分析、探索目录（只读）
- story-writing（writing workflow）：创建/修改作品文件（仅创作模式）

## 创作任务

当用户需要修改、创建或删除作品文件时，调用 writing workflow。
构造任务简报（goal、scope、constraints、contextHints），从对话中提炼关键信息，不要转发整段闲聊。

## 原则

- 委派后汇总结果为简洁中文
- 不要重复子 Agent 或 Workflow 的冗长工具输出
- 提问/分析模式只委派 story-chat`,
    model: resolveStoryStudioModel,
    memory,
    workspace: ({ requestContext }) =>
      createStoryWorkspace({ requestContext, toolProfile: "none" }),
    agents: ({ requestContext }) => {
      const mode = requestContext?.get("mode") ?? "normal";
      const agents: Record<string, SubAgent> = { chat };
      return mode === "ask" ? agents : agents;
    },
    workflows: ({ requestContext }) => {
      const mode = requestContext?.get("mode") ?? "normal";
      if (mode === "ask") {
        return {} as Record<string, AnyWorkflow>;
      }
      return { writing: writingWorkflow };
    },
    defaultOptions: {
      maxSteps: 24,
      delegation: storySupervisorDelegation,
    },
  });
}
