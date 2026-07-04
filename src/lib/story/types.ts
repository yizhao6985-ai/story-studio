export type AgentMode = "ask" | "normal" | "scheme";

export type SchemePhase = "drafting" | "executing";

/** 从 README 或本机元数据解析的作品展示信息 */
export interface WorkManifest {
  title: string;
}

export interface WorkSnapshot {
  workPath: string;
  manifest: WorkManifest;
  /** 本机 revision，用于 UI 刷新（userData，非作品文件） */
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
