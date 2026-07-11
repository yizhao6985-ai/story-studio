import { z } from "zod";

export const subTaskTypeSchema = z.enum([
  "read",
  "answer",
  "create",
  "edit",
  "delete",
]);

export const subTaskSchema = z.object({
  type: subTaskTypeSchema,
  goal: z.string().min(1),
  scope: z.array(z.string()).optional(),
  targets: z.array(z.string()).optional(),
});

export const userIntentSchema = z.object({
  summary: z.string(),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().optional(),
  subTasks: z.array(subTaskSchema),
});

export const taskResultSchema = z.object({
  task: subTaskSchema,
  output: z.string(),
  changedFiles: z.array(z.string()),
});
