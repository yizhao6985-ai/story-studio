/**
 * Story Studio 本地 Agent 主图：prepare → route → plan → think ↔ execute → synthesize
 */
import { END, START, StateGraph } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

import { advanceSubtaskNode } from "#agent/nodes/advance-subtask/index.js";
import { escalateNode } from "#agent/nodes/escalate/index.js";
import { executeToolsNode } from "#agent/nodes/execute-tools/index.js";
import { planTasksNode } from "#agent/nodes/plan-tasks/index.js";
import { prepareTurnNode } from "#agent/nodes/prepare-turn/index.js";
import { compactContextNode } from "#agent/nodes/compact-context/index.js";
import { routeTurnNode } from "#agent/nodes/route-turn/index.js";
import {
  routeAfterAdvance,
  routeAfterExecute,
  routeAfterRouteTurn,
  routeAfterThink,
} from "#agent/nodes/routes.js";
import { synthesizeNode } from "#agent/nodes/synthesize/index.js";
import { thinkNode } from "#agent/nodes/think/index.js";
import { AgentState } from "#agent/graph/state.js";

const workflow = new StateGraph(AgentState)
  .addNode("prepareTurn", prepareTurnNode)
  .addNode("compactContext", compactContextNode)
  .addNode("routeTurn", routeTurnNode)
  .addNode("planTasks", planTasksNode)
  .addNode("think", thinkNode)
  .addNode("executeTools", executeToolsNode)
  .addNode("advanceSubtask", advanceSubtaskNode)
  .addNode("synthesize", synthesizeNode)
  .addNode("escalate", escalateNode)
  .addEdge(START, "prepareTurn")
  .addEdge("prepareTurn", "compactContext")
  .addEdge("compactContext", "routeTurn")
  .addConditionalEdges("routeTurn", routeAfterRouteTurn, [
    "planTasks",
    "synthesize",
  ])
  .addEdge("planTasks", "think")
  .addConditionalEdges("think", routeAfterThink, [
    "executeTools",
    "synthesize",
    "escalate",
    "advanceSubtask",
  ])
  .addConditionalEdges("executeTools", routeAfterExecute, [
    "think",
    "escalate",
    "synthesize",
  ])
  .addConditionalEdges("advanceSubtask", routeAfterAdvance, [
    "think",
    "synthesize",
  ])
  .addEdge("synthesize", END)
  .addEdge("escalate", END);

export async function createGraph(checkpointer?: BaseCheckpointSaver) {
  return workflow.compile({ checkpointer });
}
