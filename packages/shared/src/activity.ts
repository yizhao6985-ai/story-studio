import type { DelegateSessionStatus } from "./agent-types.js";

export type AgentActivityEvent =
  | { type: "status"; status: "thinking" | "executing" }
  | { type: "reply_delta"; delta: string }
  | { type: "done"; reply: string }
  | {
      type: "error";
      source?: "llm" | "app";
      kind?: string;
      message: string;
      suggestion?: string;
      detail?: string;
    };

export type DelegateActivityEvent =
  | AgentActivityEvent
  | {
      type: "delegate_turn";
      turn: number;
      message: string;
      rationale?: string;
    }
  | {
      type: "delegate_status";
      status: "running";
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
