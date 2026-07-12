export type WorkFileKind =
  | "chapter"
  | "character"
  | "setting"
  | "outline"
  | "note"
  | "other";

export type WorkFileSummary = {
  path: string;
  hash: string;
  kind: WorkFileKind;
  summary: string;
  entities?: string[];
};

export type WorkContext = {
  workPath: string;
  revision: number;
  generatedAt: string;
  workBrief: string;
  files: WorkFileSummary[];
};

export type RelevantContext = {
  workBrief: string;
  relevantFiles: WorkFileSummary[];
  fileIndex: string[];
};
