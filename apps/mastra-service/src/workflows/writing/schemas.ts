import { z } from "zod";

export const writingTaskBriefSchema = z.object({
  goal: z.string().min(1),
  scope: z.array(z.string()).default([]),
  constraints: z.string().optional(),
  contextHints: z.string().optional(),
});

export const writingPlanSchema = z.object({
  targets: z.array(z.string()),
  strategy: z.string(),
  risks: z.array(z.string()).optional(),
});

export const writingExploreFindingSchema = z.object({
  path: z.string(),
  summary: z.string(),
  relevantExcerpt: z.string().optional(),
});

export const writingExploreSchema = z.object({
  findings: z.array(writingExploreFindingSchema),
});

export const writingExecuteSchema = z.object({
  changedFiles: z.array(z.string()),
  changeSummary: z.string(),
});

export const writingVerifySchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.string()),
  notes: z.string().optional(),
});

export const writingReportSchema = z.object({
  summary: z.string(),
  changedFiles: z.array(z.string()),
  openQuestions: z.array(z.string()).optional(),
});
