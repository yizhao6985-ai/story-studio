import { END, START, StateGraph } from "@langchain/langgraph";

import { editLoopNode } from "./nodes/edit-loop.js";
import {
  advanceTaskNode,
  analyzeIntentNode,
  generateTasksNode,
  routeAfterGenerate,
  routeDispatch,
} from "./nodes/intent.js";
import { clarifyNode, prepareTurnNode } from "./nodes/prepare.js";
import { readLoopNode } from "./nodes/read-loop.js";
import { respondNode } from "./nodes/respond-node.js";
import { StudioState } from "./state.js";

export function createStudioGraph() {
  const graph = new StateGraph(StudioState)
    .addNode("prepare", prepareTurnNode)
    .addNode("analyze_intent", analyzeIntentNode)
    .addNode("generate_tasks", generateTasksNode)
    .addNode("clarify", clarifyNode)
    .addNode("dispatch", () => ({}))
    .addNode("read_loop", readLoopNode)
    .addNode("edit_loop", editLoopNode)
    .addNode("advance", advanceTaskNode)
    .addNode("respond", respondNode)
    .addEdge(START, "prepare")
    .addEdge("prepare", "analyze_intent")
    .addEdge("analyze_intent", "generate_tasks")
    .addConditionalEdges("generate_tasks", routeAfterGenerate, {
      clarify: "clarify",
      dispatch: "dispatch",
    })
    .addEdge("clarify", END)
    .addConditionalEdges("dispatch", routeDispatch, {
      read: "read_loop",
      respond: "respond",
      edit: "edit_loop",
    })
    .addEdge("read_loop", "advance")
    .addEdge("edit_loop", "advance")
    .addEdge("advance", "dispatch")
    .addEdge("respond", END);

  return graph.compile().withConfig({ recursionLimit: 100 });
}
