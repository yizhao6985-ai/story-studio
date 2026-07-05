export type AgentMode = "ask" | "normal";

export interface WorkManifest {
  title: string;
}

export interface WorkSnapshot {
  workPath: string;
  manifest: WorkManifest;
  revision: number;
}

export interface WorkspaceEntry {
  path: string;
  name: string;
  kind: "file" | "directory";
  children?: WorkspaceEntry[];
}

export interface ConversationManifest {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
