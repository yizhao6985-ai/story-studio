import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

import type {
  SubTask,
  TaskResult,
  UserIntent,
} from "@story-studio/shared/task-types";
import type { AgentMode } from "@story-studio/shared/story";

import type { RelevantContext } from "../../context/types.js";

function overwrite<T>() {
  return Annotation<T | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  });
}

function overwriteArray<T>() {
  return Annotation<T[]>({
    reducer: (_, next) => next,
    default: () => [],
  });
}

export const StudioState = Annotation.Root({
  ...MessagesAnnotation.spec,
  mode: overwrite<AgentMode>(),
  userMessage: overwrite<string>(),
  projectContext: overwrite<RelevantContext>(),
  intent: overwrite<UserIntent>(),
  taskQueue: overwriteArray<SubTask>(),
  taskIndex: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  taskResults: overwriteArray<TaskResult>(),
  changedFiles: overwriteArray<string>(),
});

export type StudioGraphState = typeof StudioState.State;
