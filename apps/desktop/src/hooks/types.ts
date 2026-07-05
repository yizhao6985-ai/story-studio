import type { WorkManifest } from "@/lib/story";

export type AgentMode = "ask" | "normal";
export type ComposerMode = AgentMode | "delegate";

export const DEFAULT_DELEGATE_MAX_TURNS = 10;
export const DELEGATE_MAX_TURNS_MIN = 1;
export const DELEGATE_MAX_TURNS_MAX = 30;

export type DelegateSessionStatus =
  | "running"
  | "completed"
  | "max_turns"
  | "paused"
  | "failed";

export type DelegateSessionInfo = {
  status: DelegateSessionStatus;
  turn: number;
  maxTurns: number;
  artifactPaths: string[];
  goal: string;
};

export type WorkspaceEntry = {
  manifest: WorkManifest;
  workPath: string;
};
