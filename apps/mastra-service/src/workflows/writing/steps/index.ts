import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import {
  writingExecuteSchema,
  writingExploreSchema,
  writingPlanSchema,
  writingTaskBriefSchema,
  writingVerifySchema,
} from "../schemas.js";
import { writingSupervisorDelegation } from "../../../agents/writing-supervisor/delegation.js";
import {
  formatExecutePrompt,
  formatExplorePrompt,
  formatPlanPrompt,
  formatVerifyPrompt,
} from "../prompts.js";
import { deepSeekStructuredOutput } from "../structured-output.js";

const planOutputSchema = z.object({
  brief: writingTaskBriefSchema,
  plan: writingPlanSchema,
});

export const planStep = createStep({
  id: "writing-plan",
  description: "根据任务简报制定写作计划",
  inputSchema: writingTaskBriefSchema,
  outputSchema: planOutputSchema,
  execute: async ({ inputData, mastra, requestContext }) => {
    const planner = mastra.getAgent("writingPlanner");
    const response = await planner.generate(formatPlanPrompt(inputData), {
      requestContext,
      structuredOutput: deepSeekStructuredOutput(writingPlanSchema),
    });

    const plan = response.object;
    if (!plan) {
      throw new Error("WRITING_PLAN_FAILED");
    }

    return { brief: inputData, plan };
  },
});

const exploreOutputSchema = z.object({
  brief: writingTaskBriefSchema,
  plan: writingPlanSchema,
  explore: writingExploreSchema,
});

export const exploreStep = createStep({
  id: "writing-explore",
  description: "探索并阅读相关作品文件",
  inputSchema: planOutputSchema,
  outputSchema: exploreOutputSchema,
  execute: async ({ inputData, mastra, requestContext }) => {
    const explorer = mastra.getAgent("writingExplorer");
    const response = await explorer.generate(
      formatExplorePrompt(inputData.brief, inputData.plan),
      {
        requestContext,
        maxSteps: 12,
        structuredOutput: deepSeekStructuredOutput(writingExploreSchema),
      },
    );

    const explore = response.object ?? { findings: [] };
    return {
      brief: inputData.brief,
      plan: inputData.plan,
      explore,
    };
  },
});

const executeOutputSchema = z.object({
  brief: writingTaskBriefSchema,
  plan: writingPlanSchema,
  explore: writingExploreSchema,
  changedFiles: z.array(z.string()),
  changeSummary: z.string(),
});

export const executeStep = createStep({
  id: "writing-execute",
  description: "协调写作子 Agent 执行文件修改",
  inputSchema: exploreOutputSchema,
  outputSchema: executeOutputSchema,
  execute: async ({ inputData, mastra, requestContext }) => {
    const supervisor = mastra.getAgent("writingSupervisor");
    const response = await supervisor.generate(
      formatExecutePrompt(inputData.brief, inputData.plan, inputData.explore),
      {
        requestContext,
        maxSteps: 20,
        delegation: writingSupervisorDelegation,
        structuredOutput: deepSeekStructuredOutput(writingExecuteSchema),
      },
    );

    const result = response.object;
    const text = response.text.trim();
    const changedFiles = result?.changedFiles ?? [];
    const changeSummary = result?.changeSummary ?? text;

    return {
      brief: inputData.brief,
      plan: inputData.plan,
      explore: inputData.explore,
      changedFiles,
      changeSummary,
    };
  },
});

export const verifyOutputSchema = executeOutputSchema.extend({
  verify: z.object({
    passed: z.boolean(),
    issues: z.array(z.string()),
    notes: z.string().optional(),
  }),
});

export const verifyStep = createStep({
  id: "writing-verify",
  description: "校验改动是否符合任务",
  inputSchema: executeOutputSchema,
  outputSchema: verifyOutputSchema,
  execute: async ({ inputData, mastra, requestContext }) => {
    const verifier = mastra.getAgent("writingVerifier");
    const response = await verifier.generate(
      formatVerifyPrompt(
        inputData.brief,
        inputData.changedFiles,
        inputData.changeSummary,
      ),
      {
        requestContext,
        maxSteps: 8,
        structuredOutput: deepSeekStructuredOutput(writingVerifySchema),
      },
    );

    const verify = response.object ?? {
      passed: true,
      issues: [] as string[],
    };

    return {
      ...inputData,
      verify,
    };
  },
});
