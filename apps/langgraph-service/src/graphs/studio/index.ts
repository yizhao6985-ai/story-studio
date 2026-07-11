import { END, START, StateGraph } from "@langchain/langgraph";

import { askLoopNode } from "./nodes/ask-loop.js";
import { editLoopNode } from "./nodes/edit-loop.js";
import {
  advanceTaskNode,
  analyzeIntentNode,
  generateTasksNode,
  routeAfterGenerate,
  routeDispatch,
} from "./nodes/intent.js";
import { clarifyNode, prepareTurnNode } from "./nodes/prepare.js";
import { summarizeNode } from "./nodes/summarize.js";
import { StudioState } from "./state.js";

export function createStudioGraph() {
  const graph = new StateGraph(StudioState)
    .addNode("prepare", prepareTurnNode)
    .addNode("analyze_intent", analyzeIntentNode)
    .addNode("generate_tasks", generateTasksNode)
    .addNode("clarify", clarifyNode)
    .addNode("dispatch", () => ({}))
    .addNode("ask_loop", askLoopNode)
    .addNode("edit_loop", editLoopNode)
    .addNode("advance", advanceTaskNode)
    .addNode("summarize", summarizeNode)
    .addEdge(START, "prepare")
    .addEdge("prepare", "analyze_intent")
    .addEdge("analyze_intent", "generate_tasks")
    .addConditionalEdges("generate_tasks", routeAfterGenerate, {
      clarify: "clarify",
      dispatch: "dispatch",
    })
    .addEdge("clarify", END)
    .addConditionalEdges("dispatch", routeDispatch, {
      ask: "ask_loop",
      edit: "edit_loop",
      summarize: "summarize",
    })
    .addEdge("ask_loop", "advance")
    .addEdge("edit_loop", "advance")
    .addEdge("advance", "dispatch")
    .addEdge("summarize", END);

  return graph.compile();
}
