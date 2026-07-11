import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentMode } from "@story-studio/shared/story";

export function getModeFromConfig(config?: RunnableConfig): AgentMode {
  const mode = config?.configurable?.mode;
  return mode === "ask" ? "ask" : "normal";
}
