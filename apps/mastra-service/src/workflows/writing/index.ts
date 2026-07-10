import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { writingReportSchema } from "./schemas.js";
import {
  executeStep,
  exploreStep,
  planStep,
  verifyOutputSchema,
  verifyStep,
} from "./steps/index.js";

const reportStep = createStep({
  id: "writing-report",
  description: "压缩写作结果为面向用户的报告",
  inputSchema: verifyOutputSchema,
  outputSchema: writingReportSchema,
  execute: async ({ inputData }) => {
    const { changedFiles, changeSummary, verify } = inputData;
    const issues = verify.issues.filter(Boolean);
    const summaryParts = [
      changeSummary.slice(0, 500),
      verify.passed ? "校验通过。" : `校验未通过：${issues.join("；")}`,
    ];

    return {
      summary: summaryParts.join("\n"),
      changedFiles,
      openQuestions: issues.length > 0 ? issues : undefined,
    };
  },
});

export function createWritingWorkflow() {
  return createWorkflow({
    id: "story-writing",
    description:
      "故事创作写作流程：规划 → 探索 → 执行 → 校验 → 汇报。接收任务简报，返回压缩报告。",
    inputSchema: z.object({
      goal: z.string().min(1),
      scope: z.array(z.string()).default([]),
      constraints: z.string().optional(),
      contextHints: z.string().optional(),
    }),
    outputSchema: writingReportSchema,
  })
    .then(planStep)
    .then(exploreStep)
    .then(executeStep)
    .then(verifyStep)
    .then(reportStep)
    .commit();
}
