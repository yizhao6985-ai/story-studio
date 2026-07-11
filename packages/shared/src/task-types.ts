export type SubTaskType = "read" | "answer" | "create" | "edit" | "delete";

/** 意图分析后的单个子任务。 */
export type SubTask = {
  type: SubTaskType;
  goal: string;
  scope?: string[];
  targets?: string[];
};

export type UserIntent = {
  summary: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
  subTasks: SubTask[];
};

export type TaskResult = {
  task: SubTask;
  output: string;
  changedFiles: string[];
};
