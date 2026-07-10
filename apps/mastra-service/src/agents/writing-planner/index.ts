import { Agent } from "@mastra/core/agent";

import { resolveStoryStudioModel } from "../../platform/llm/model.js";

export function createWritingPlannerAgent() {
  return new Agent({
    id: "writing-planner",
    name: "Writing Planner",
    description: "根据任务简报制定写作计划，不访问文件系统。",
    instructions: `你是 Story Studio 写作规划器。根据任务简报制定可执行的写作计划。

输出要求：
- targets：需要阅读或修改的文件路径（相对路径）
- strategy：分步执行策略（中文，简洁）
- risks：潜在风险（可选）

不要调用工具，不要编造不存在的文件内容。`,
    model: resolveStoryStudioModel,
  });
}
