import { Agent } from "@mastra/core/agent";
import type { SubAgent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import {
  LocalFilesystem,
  WORKSPACE_TOOLS,
  Workspace,
} from "@mastra/core/workspace";

import { resolveStoryStudioModel } from "../../platform/llm/model.js";
import { requireWorkPath } from "../../platform/work-path.js";
import { createChatAgent } from "./chat.js";
import { createWorkspaceAgent } from "./workspace.js";

const DISABLED_WORKSPACE_TOOLS = Object.fromEntries(
  [
    ...Object.values(WORKSPACE_TOOLS.FILESYSTEM),
    ...Object.values(WORKSPACE_TOOLS.SEARCH),
    ...Object.values(WORKSPACE_TOOLS.SANDBOX),
    ...Object.values(WORKSPACE_TOOLS.LSP),
  ].map((id) => [id, { enabled: false }]),
);

function createStoryWorkspace({
  requestContext,
}: {
  requestContext: Parameters<typeof requireWorkPath>[0];
}) {
  const workPath = requireWorkPath(requestContext);
  return new Workspace({
    id: "story-work",
    name: "Story Work",
    filesystem: new LocalFilesystem({ basePath: workPath }),
    tools: DISABLED_WORKSPACE_TOOLS,
  });
}

export function createSupervisorAgent(memory: Memory) {
  const chat = createChatAgent();
  const workspace = createWorkspaceAgent();

  return new Agent({
    id: "story-supervisor",
    name: "Story Supervisor",
    instructions: `你是 Story Studio 总协调者（Supervisor）。
根据用户意图把任务委派给子 Agent：
- story-chat：问答、阅读、分析、探索目录
- story-workspace：创建/修改/删除作品文件（仅创作模式可用）

委派后汇总子 Agent 结果，用中文回复用户。不要重复子 Agent 的冗长工具输出。`,
    model: resolveStoryStudioModel,
    memory,
    workspace: ({ requestContext }) => createStoryWorkspace({ requestContext }),
    agents: ({ requestContext }) => {
      const mode = requestContext?.get("mode") ?? "normal";
      const agents: Record<string, SubAgent> = { chat };
      if (mode !== "ask") {
        agents.workspace = workspace;
      }
      return agents;
    },
    defaultOptions: {
      maxSteps: 24,
    },
  });
}
