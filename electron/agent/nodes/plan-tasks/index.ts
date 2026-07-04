import type { RunnableConfig } from "@langchain/core/runnables";

import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";
import { createInitialWorkLoop } from "#agent/shared/work-loop/types.js";

import { planTasksForTurn } from "./plan.js";

export async function planTasksNode(
  state: AgentStateType,
  config: RunnableConfig,
): Promise<AgentStatePatch> {
  const workLoop = await planTasksForTurn(
    state.workLoop ?? createInitialWorkLoop(),
    state,
    config,
  );
  return { workLoop };
}
