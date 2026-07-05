export type ChatMessage =
  | { role: "user"; text: string }
  | { role: "delegate"; text: string; turn: number }
  | {
      role: "assistant";
      text: string;
    };

export type ContextUsageResult = {
  usedTokens: number;
  maxTokens: number;
  percent: number;
  modelLabel?: string;
};

export type AgentRunResult = {
  reply: string;
  artifactPaths: string[];
};

export type DelegateSessionStatus =
  | "running"
  | "completed"
  | "max_turns"
  | "paused"
  | "failed";

export type DelegateRunResult = {
  status: DelegateSessionStatus;
  summary: string;
  artifactPaths: string[];
  turns: number;
};
