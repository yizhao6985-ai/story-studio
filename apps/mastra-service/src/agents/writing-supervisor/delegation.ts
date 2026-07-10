import type { AgentExecutionOptions } from "@mastra/core/agent";

const SUB_AGENT_MAX_STEPS: Record<string, number> = {
  explorer: 12,
  editor: 10,
  writer: 10,
  verifier: 8,
};

/** 写作子 Agent 仅接收委派 prompt，不继承全局对话历史。 */
export const writingSupervisorDelegation: NonNullable<
  AgentExecutionOptions["delegation"]
> = {
  messageFilter: () => [],
  onDelegationStart: async (context) => {
    const maxSteps = SUB_AGENT_MAX_STEPS[context.primitiveId];
    if (maxSteps) {
      return { proceed: true, modifiedMaxSteps: maxSteps };
    }
    return { proceed: true };
  },
};
