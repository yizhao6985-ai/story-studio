import type { RequestContext } from "@mastra/core/request-context";

import type { WritingReport, WritingTaskBrief } from "@story-studio/shared/writing-types";
import { getStudioMastra } from "../mastra/registry.js";

export type WritingWorkflowRunInput = {
  brief: WritingTaskBrief;
  requestContext?: RequestContext;
  abortSignal?: AbortSignal;
};

export type WritingWorkflowRunResult = {
  status: "success" | "failed";
  report?: WritingReport;
  error?: string;
};

export async function runWritingWorkflow(
  input: WritingWorkflowRunInput,
): Promise<WritingWorkflowRunResult> {
  const mastra = getStudioMastra();
  const workflow = mastra.getWorkflow("writing");
  const run = await workflow.createRun();

  const result = await run.start({
    inputData: input.brief,
    requestContext: input.requestContext,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });

  if (result.status === "success" && result.result) {
    return {
      status: "success",
      report: result.result as WritingReport,
    };
  }

  const errorMessage =
    result.status === "failed" && result.error
      ? String(result.error.message ?? result.error)
      : `Workflow ended with status: ${result.status}`;

  return {
    status: "failed",
    error: errorMessage,
  };
}
