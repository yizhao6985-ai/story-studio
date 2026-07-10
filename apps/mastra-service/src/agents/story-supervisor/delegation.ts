import type { AgentExecutionOptions } from "@mastra/core/agent";

/** 子 Agent / Workflow 仅接收委派内容，隔离全局对话与工具轨迹。 */
export const storySupervisorDelegation: NonNullable<
  AgentExecutionOptions["delegation"]
> = {
  messageFilter: ({ messages, primitiveId, primitiveType }) => {
    if (
      primitiveType === "workflow" ||
      primitiveId === "story-chat" ||
      primitiveId === "chat"
    ) {
      return [];
    }
    return messages;
  },
  onDelegationStart: async (context) => {
    if (context.primitiveType === "workflow") {
      return { proceed: true };
    }
    if (context.primitiveId === "story-chat" || context.primitiveId === "chat") {
      return { proceed: true, modifiedMaxSteps: 12 };
    }
    return { proceed: true };
  },
};
