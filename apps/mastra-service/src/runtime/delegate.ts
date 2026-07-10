import { RequestContext } from "@mastra/core/request-context";
import type { DelegateActivityEvent } from "@story-studio/shared/activity";
import {
  isUserCancelError,
  toAgentRunError,
} from "@story-studio/shared/llm-errors";
import type { DelegateRunResult } from "@story-studio/shared/agent-types";

import { cancelLocalAgent } from "./run.js";
import { runWritingWorkflow } from "./writing-workflow.js";

export type DelegateRunInput = {
  workPath: string;
  conversationId: string;
  goal: string;
  maxTurns?: number;
  onActivity?: (event: DelegateActivityEvent) => void;
  requestContext?: RequestContext;
};

const DEFAULT_MAX_TURNS = 10;

let activeDelegateAbort: AbortController | null = null;

export function cancelDelegateSession(): void {
  activeDelegateAbort?.abort();
  cancelLocalAgent();
}

function buildRequestContext(
  workPath: string,
  existing?: RequestContext,
): RequestContext {
  const requestContext = existing ?? new RequestContext();
  requestContext.set("mode", "normal");
  requestContext.set("workPath", workPath);
  return requestContext;
}

export async function runDelegateSession(
  input: DelegateRunInput,
): Promise<DelegateRunResult> {
  activeDelegateAbort?.abort();
  activeDelegateAbort = new AbortController();
  const signal = activeDelegateAbort.signal;
  const maxTurns = input.maxTurns ?? DEFAULT_MAX_TURNS;
  const goal = input.goal.trim();
  const emit = input.onActivity ?? (() => {});

  if (!goal) throw new Error("DELEGATE_GOAL_REQUIRED");

  const artifactPaths = new Set<string>();
  const requestContext = buildRequestContext(
    input.workPath,
    input.requestContext,
  );

  try {
    emit({
      type: "delegate_status",
      status: "running",
      turn: 0,
      maxTurns,
      artifactPaths: [],
      goal,
    });

    let lastSummary = "";
    let contextHints: string | undefined;

    for (let turn = 1; turn <= maxTurns; turn++) {
      if (signal.aborted) {
        return {
          status: "paused",
          summary: "托管已暂停。",
          artifactPaths: [...artifactPaths],
          turns: turn - 1,
        };
      }

      const turnLabel =
        turn === 1 ? "【托管任务】" : "【继续托管】";
      const prompt = `${turnLabel}${goal}`;

      emit({ type: "delegate_turn", turn, message: prompt });
      emit({
        type: "delegate_status",
        status: "running",
        turn,
        maxTurns,
        artifactPaths: [...artifactPaths],
        goal,
      });

      emit({ type: "status", status: "thinking" });

      const workflowResult = await runWritingWorkflow({
        brief: {
          goal,
          scope: ["**/*"],
          constraints: "自主完成托管任务；保持原有文风与格式；未明确要求不要 delete",
          contextHints,
        },
        requestContext,
        abortSignal: signal,
      });

      if (workflowResult.status === "failed") {
        const summary = workflowResult.error ?? "写作流程执行失败。";
        emit({
          type: "delegate_complete",
          status: "failed",
          summary,
          artifactPaths: [...artifactPaths],
          turns: turn,
        });
        return {
          status: "failed",
          summary,
          artifactPaths: [...artifactPaths],
          turns: turn,
        };
      }

      const report = workflowResult.report!;
      lastSummary = report.summary;
      for (const path of report.changedFiles) {
        artifactPaths.add(path);
      }

      emit({ type: "reply_delta", delta: report.summary });
      emit({ type: "done", reply: report.summary });

      const hasOpenQuestions =
        report.openQuestions && report.openQuestions.length > 0;

      if (!hasOpenQuestions) {
        emit({
          type: "delegate_complete",
          status: "completed",
          summary: report.summary,
          artifactPaths: [...artifactPaths],
          turns: turn,
        });
        return {
          status: "completed",
          summary: report.summary,
          artifactPaths: [...artifactPaths],
          turns: turn,
        };
      }

      contextHints = report.openQuestions!.join("\n");
    }

    const summary = `已达最大轮数（${maxTurns}）。最后状态：${lastSummary.slice(0, 200)}`;
    emit({
      type: "delegate_complete",
      status: "max_turns",
      summary,
      artifactPaths: [...artifactPaths],
      turns: maxTurns,
    });
    return {
      status: "max_turns",
      summary,
      artifactPaths: [...artifactPaths],
      turns: maxTurns,
    };
  } catch (error) {
    if (isUserCancelError(error)) {
      return {
        status: "paused",
        summary: "托管已暂停。",
        artifactPaths: [...artifactPaths],
        turns: 0,
      };
    }
    const agentError = toAgentRunError(error);
    return {
      status: "failed",
      summary: agentError.userMessage,
      artifactPaths: [...artifactPaths],
      turns: 0,
    };
  } finally {
    activeDelegateAbort = null;
  }
}
