import type { ActivityEntry } from "../shared/work-loop/types.js";

export type SubTaskSummary = {
  id: string;
  intent: string;
  status: string;
};

export type AgentActivityEvent =
  | { type: "status"; status: "planning" | "thinking" | "executing" | "synthesizing" }
  | { type: "subtasks"; subtasks: SubTaskSummary[] }
  | { type: "step"; entry: ActivityEntry }
  | { type: "reply_delta"; delta: string }
  | { type: "context_compacted" }
  | { type: "done"; reply: string }
  | { type: "error"; message: string };

export type DelegateSessionStatus =
  | "running"
  | "completed"
  | "escalated"
  | "max_turns"
  | "paused"
  | "failed";

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

let emitter: ((event: DelegateActivityEvent) => void) | null = null;

export function setAgentActivityEmitter(
  fn: ((event: DelegateActivityEvent) => void) | null,
): void {
  emitter = fn;
}

export function emitAgentActivity(event: DelegateActivityEvent): void {
  emitter?.(event);
}
