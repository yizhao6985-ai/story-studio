import type {
  AgentActivityEvent,
  DelegateActivityEvent,
} from "@story-studio/shared/activity";
import type { RequestContext } from "@mastra/core/request-context";
import {
  isUserCancelError,
  toAgentRunError,
} from "@story-studio/shared/llm-errors";
import type { DelegateRunResult } from "@story-studio/shared/agent-types";
import { cancelLocalAgent, runLocalAgent } from "./run.js";

export type DelegateRunInput = {
  workPath: string;
  conversationId: string;
  goal: string;
  maxTurns?: number;
  onActivity?: (event: DelegateActivityEvent) => void;
  requestContext?: RequestContext;
};

const DEFAULT_MAX_TURNS = 10;
const COMPLETE_TAG = "[DELEGATE_COMPLETE]";

let activeDelegateAbort: AbortController | null = null;

export function cancelDelegateSession(): void {
  activeDelegateAbort?.abort();
  cancelLocalAgent();
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

  try {
    emit({
      type: "delegate_status",
      status: "running",
      turn: 0,
      maxTurns,
      artifactPaths: [],
      goal,
    });

    let lastReply = "";
    for (let turn = 1; turn <= maxTurns; turn++) {
      if (signal.aborted) {
        return {
          status: "paused",
          summary: "托管已暂停。",
          artifactPaths: [...artifactPaths],
          turns: turn - 1,
        };
      }

      const prompt =
        turn === 1
          ? `【托管任务】${goal}\n请自主探索作品、完成修改。完成后在回复末尾单独一行输出 ${COMPLETE_TAG} 和简要摘要。`
          : `【继续托管】${goal}\n上一轮尚未完成。请继续推进；完成时输出 ${COMPLETE_TAG}。`;

      emit({ type: "delegate_turn", turn, message: prompt });
      emit({
        type: "delegate_status",
        status: "running",
        turn,
        maxTurns,
        artifactPaths: [...artifactPaths],
        goal,
      });

      const result = await runLocalAgent({
        workPath: input.workPath,
        conversationId: input.conversationId,
        message: prompt,
        mode: "normal",
        manageActivityEmitter: false,
        requestContext: input.requestContext,
        onActivity: emit as (event: AgentActivityEvent) => void,
      });

      lastReply = result.reply;
      for (const path of result.artifactPaths) {
        artifactPaths.add(path);
      }

      if (lastReply.includes(COMPLETE_TAG)) {
        const summary = lastReply.replace(COMPLETE_TAG, "").trim();
        emit({
          type: "delegate_complete",
          status: "completed",
          summary,
          artifactPaths: [...artifactPaths],
          turns: turn,
        });
        return {
          status: "completed",
          summary,
          artifactPaths: [...artifactPaths],
          turns: turn,
        };
      }
    }

    const summary = `已达最大轮数（${maxTurns}）。最后状态：${lastReply.slice(0, 200)}`;
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
