import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";
import { createInitialWorkLoop } from "#agent/shared/work-loop/types.js";

export async function prepareTurnNode(
  _state: AgentStateType,
): Promise<AgentStatePatch> {
  return {
    workLoop: createInitialWorkLoop(),
    turnRoute: null,
  };
}
