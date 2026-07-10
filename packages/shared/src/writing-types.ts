/** Global Supervisor 委派给写作 Workflow 的任务简报。 */
export type WritingTaskBrief = {
  goal: string;
  scope: string[];
  constraints?: string;
  contextHints?: string;
};

export type WritingPlan = {
  targets: string[];
  strategy: string;
  risks?: string[];
};

export type WritingExploreFinding = {
  path: string;
  summary: string;
  relevantExcerpt?: string;
};

export type WritingExploreResult = {
  findings: WritingExploreFinding[];
};

export type WritingExecuteResult = {
  changedFiles: string[];
  changeSummary: string;
};

export type WritingVerifyResult = {
  passed: boolean;
  issues: string[];
  notes?: string;
};

/** 写作 Workflow 返回给 Global Supervisor 的压缩报告。 */
export type WritingReport = {
  summary: string;
  changedFiles: string[];
  openQuestions?: string[];
};
