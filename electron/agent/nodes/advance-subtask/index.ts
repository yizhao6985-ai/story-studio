import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";

import { advanceSubtask } from "./subtasks.js";

export async function advanceSubtaskNode(
  state: AgentStateType,
): Promise<AgentStatePatch> {
  return { workLoop: advanceSubtask(state.workLoop!) };
}
