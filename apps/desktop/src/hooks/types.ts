import type { WorkManifest } from "@/lib/story";

export type AgentMode = "ask" | "normal";
export type ComposerMode = AgentMode;

export type WorkspaceEntry = {
  manifest: WorkManifest;
  workPath: string;
};
