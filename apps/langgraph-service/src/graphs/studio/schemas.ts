import { z } from "zod";

export const subTaskTypeSchema = z.enum([
  "read",
  "answer",
  "create",
  "edit",
  "delete",
]);

function normalizeSubTaskGoal(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;

  const task = raw as Record<string, unknown>;
  const existingGoal = typeof task.goal === "string" ? task.goal.trim() : "";
  if (existingGoal) return { ...task, goal: existingGoal };

  const fallbackGoal =
    (typeof task.description === "string" && task.description.trim()) ||
    (typeof task.objective === "string" && task.objective.trim()) ||
    (typeof task.type === "string" ? `执行 ${task.type} 子任务` : "");

  return { ...task, goal: fallbackGoal };
}

export const subTaskSchema = z.preprocess(
  normalizeSubTaskGoal,
  z.object({
    type: subTaskTypeSchema,
    goal: z.string().min(1),
    scope: z.array(z.string()).nullable(),
    targets: z.array(z.string()).nullable(),
  }),
);

export const userIntentSchema = z.object({
  summary: z.string(),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  subTasks: z.array(subTaskSchema),
});

export const taskResultSchema = z.object({
  task: subTaskSchema,
  output: z.string(),
  changedFiles: z.array(z.string()),
});
