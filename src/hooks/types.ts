import type { WorkManifest } from "@/lib/story";

export type AgentMode = "ask" | "normal" | "scheme";
export type ComposerMode = AgentMode | "delegate";

export const DEFAULT_DELEGATE_MAX_TURNS = 10;
export const DELEGATE_MAX_TURNS_MIN = 1;
export const DELEGATE_MAX_TURNS_MAX = 30;
export type SchemePhase = "drafting" | "executing";

export type DelegateSessionStatus =
  | "running"
  | "completed"
  | "escalated"
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

export type ActivityStage =
  | "plan"
  | "explore"
  | "read"
  | "target"
  | "act"
  | "verify";

export type ActivityEntry = {
  id: string;
  subtaskId?: string;
  stage: ActivityStage;
  action: string;
  label: string;
  detail?: string;
  path?: string;
  status: "done" | "error";
};

export type SubTaskSummary = {
  id: string;
  intent: string;
  status: string;
};

export type AgentRunStatus =
  | "planning"
  | "thinking"
  | "executing"
  | "synthesizing";

export type AgentActivityEvent =
  | { type: "status"; status: AgentRunStatus }
  | { type: "subtasks"; subtasks: SubTaskSummary[] }
  | { type: "step"; entry: ActivityEntry }
  | { type: "reply_delta"; delta: string }
  | { type: "context_compacted" }
  | { type: "done"; reply: string }
  | { type: "error"; message: string }
  | {
      type: "delegate_turn";
      turn: number;
      message: string;
      rationale?: string;
    }
  | {
      type: "delegate_status";
      status: "running" | "planning" | "evaluating";
      turn: number;
      maxTurns: number;
      artifactPaths: string[];
      goal: string;
    }
  | {
      type: "delegate_complete";
      status: DelegateSessionStatus;
      summary: string;
      artifactPaths: string[];
      turns: number;
    };

export type ChatMessage =
  | { role: "user"; text: string }
  | { role: "delegate"; text: string; turn: number }
  | {
      role: "assistant";
      text: string;
      streaming?: boolean;
      activityLog?: ActivityEntry[];
      subtasks?: SubTaskSummary[];
      agentStatus?: AgentRunStatus;
    }
  | {
      role: "delegate_summary";
      text: string;
      status: DelegateSessionStatus;
      artifactPaths: string[];
      turns: number;
    };

export type WorkspaceEntry = {
  manifest: WorkManifest;
  workPath: string;
};
