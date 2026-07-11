import { createStudioGraph } from "./studio/index.js";

let compiledGraph: ReturnType<typeof createStudioGraph> | null = null;

export async function graph() {
  if (!compiledGraph) {
    compiledGraph = createStudioGraph();
  }
  return compiledGraph;
}
