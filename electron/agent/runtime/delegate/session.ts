import { randomUUID } from "node:crypto";

import { buildDelegateTurnKwargs } from "#agent/messages/turn-meta.js";
import {
  DEFAULT_DELEGATE_MAX_TURNS,
  formatConversationForOrchestrator,
} from "#agent/runtime/delegate/prompt.js";
import {
  createInitialSessionOutcome,
  evaluateObjectiveCompletion,
  mergeSessionOutcome,
  type SessionOutcome,
} from "#agent/runtime/delegate/completion-gate.js";
import {
  orchestratorDecide,
  orchestratorEvaluateAlignment,
  type OrchestratorDecision,
} from "#agent/runtime/delegate/orchestrator.js";
import {
  emitAgentActivity,
  setAgentActivityEmitter,
  type DelegateActivityEvent,
} from "#agent/runtime/activity.js";
import {
  cancelLocalAgent,
  loadConversationMessages,
  runLocalAgent,
  type AgentRunResult,
} from "#agent/runtime/runner.js";
import {
  formatClassifiedErrorMessage,
  isAgentRunTimeoutError,
  isUserCancelError,
  toAgentRunError,
} from "../../../../src/lib/llm-errors.js";
import { isLlmLayerError } from "../../../../src/lib/agent-error-display.js";

export type DelegateSessionStatus =
  | "completed"
  | "escalated"
  | "max_turns"
  | "paused"
  | "failed";

export type DelegateRunInput = {
  workPath: string;
  conversationId: string;
  goal: string;
  maxTurns?: number;
  onActivity?: (event: DelegateActivityEvent) => void;
};

export type DelegateRunResult = {
  status: DelegateSessionStatus;
  summary: string;
  artifactPaths: string[];
  turns: number;
};

type CompletionCheck =
  | { kind: "completed"; result: DelegateRunResult }
  | { kind: "misaligned"; reason: string }
  | { kind: "not_ready" };

let activeDelegateAbort: AbortController | null = null;

function emitDelegate(event: DelegateActivityEvent): void {
  emitAgentActivity(event);
}

function delegatePausedResult(input: {
  summary: string;
  artifactPaths: string[];
  turns: number;
}): DelegateRunResult {
  emitDelegate({
    type: "delegate_complete",
    status: "paused",
    summary: input.summary,
    artifactPaths: input.artifactPaths,
    turns: input.turns,
  });
  return {
    status: "paused",
    summary: input.summary,
    artifactPaths: input.artifactPaths,
    turns: input.turns,
  };
}

function handleDelegateAgentError(
  error: unknown,
  artifactPaths: string[],
  turns: number,
): DelegateRunResult | null {
  if (isUserCancelError(error)) {
    return delegatePausedResult({
      summary: "托管已暂停。",
      artifactPaths,
      turns,
    });
  }

  const agentError = toAgentRunError(error);
  if (
    agentError.kind === "content_policy" ||
    isAgentRunTimeoutError(error)
  ) {
    if (isLlmLayerError(agentError, error)) {
      emitDelegate({
        type: "error",
        source: "llm",
        kind: agentError.kind,
        message: agentError.userMessage,
        suggestion: agentError.suggestion,
        detail: agentError.raw,
      });
    }
    return delegatePausedResult({
      summary: isAgentRunTimeoutError(error)
        ? "托管已暂停。执行超时，请缩小目标范围。"
        : "托管已暂停。AI 服务返回错误，请查看下方红色提示。",
      artifactPaths,
      turns,
    });
  }

  return null;
}

export function cancelDelegateSession(): void {
  activeDelegateAbort?.abort();
  cancelLocalAgent();
}

function buildContinueHint(reason: string, artifactPaths: string[]): string {
  const artifactBlock =
    artifactPaths.length > 0 ? artifactPaths.join("、") : "已有写入记录";
  return `已有落盘产出（${artifactBlock}），但尚未完全满足目标：${reason}。请 send 一条具体消息继续推进，不要 complete。`;
}

async function checkSessionCompletion(input: {
  goal: string;
  outcome: SessionOutcome;
  lastReply: string;
  historyText: string;
  turn: number;
  maxTurns: number;
  summaryOverride?: string;
  signal: AbortSignal;
}): Promise<CompletionCheck> {
  const gate = evaluateObjectiveCompletion(input.outcome);
  if (!gate.passed || !input.lastReply.trim()) {
    return { kind: "not_ready" };
  }

  emitDelegate({
    type: "delegate_status",
    status: "evaluating",
    turn: input.turn,
    maxTurns: input.maxTurns,
    artifactPaths: input.outcome.artifactPaths,
    goal: input.goal,
  });

  const alignment = await orchestratorEvaluateAlignment(
    {
      goal: input.goal,
      artifactPaths: input.outcome.artifactPaths,
      lastReply: input.lastReply,
      historyText: input.historyText,
    },
    { signal: input.signal },
  );

  if (!alignment.aligned) {
    return { kind: "misaligned", reason: alignment.summary };
  }

  const summary = input.summaryOverride?.trim() || alignment.summary;
  const result: DelegateRunResult = {
    status: "completed",
    summary,
    artifactPaths: input.outcome.artifactPaths,
    turns: input.turn,
  };

  emitDelegate({
    type: "delegate_complete",
    status: "completed",
    summary,
    artifactPaths: input.outcome.artifactPaths,
    turns: input.turn,
  });

  return { kind: "completed", result };
}

async function resolveSendDecision(input: {
  goal: string;
  turn: number;
  maxTurns: number;
  artifactPaths: string[];
  gatePassed: boolean;
  gateReason: string;
  historyText: string;
  lastReply: string;
  forceContinue?: string;
  signal: AbortSignal;
}): Promise<OrchestratorDecision> {
  const decision = await orchestratorDecide(input, { signal: input.signal });

  if (decision.action === "send") {
    return decision;
  }

  if (decision.action === "escalate") {
    return decision;
  }

  if (!input.gatePassed) {
    const forced = await orchestratorDecide(
      {
        ...input,
        forceContinue:
          input.forceContinue ??
          "尚无落盘产出，禁止 complete。请 send，推进 Story Studio 实际写入或创建文件。",
      },
      { signal: input.signal },
    );

    if (forced.action === "send" && forced.message?.trim()) {
      return forced;
    }

    return {
      action: "send",
      message: "请把当前目标落实为实际文件写入或创建。",
      rationale: "系统自动续推",
    };
  }

  return decision;
}

export async function runDelegateSession(
  input: DelegateRunInput,
): Promise<DelegateRunResult> {
  activeDelegateAbort?.abort();
  activeDelegateAbort = new AbortController();
  const signal = activeDelegateAbort.signal;
  const sessionId = randomUUID();
  const maxTurns = input.maxTurns ?? DEFAULT_DELEGATE_MAX_TURNS;
  const goal = input.goal.trim();

  if (!goal) {
    throw new Error("DELEGATE_GOAL_REQUIRED");
  }

  setAgentActivityEmitter(input.onActivity ?? null);

  let turn = 0;
  let outcome: SessionOutcome = createInitialSessionOutcome();
  let lastReply = "";
  let continueHint: string | undefined;

  try {
    emitDelegate({
      type: "delegate_status",
      status: "running",
      turn,
      maxTurns,
      artifactPaths: [],
      goal,
    });

    while (!signal.aborted) {
      if (turn >= maxTurns) {
        const summary = `已达最大轮数（${maxTurns}），但尚未满足完成条件。`;
        emitDelegate({
          type: "delegate_complete",
          status: "max_turns",
          summary,
          artifactPaths: outcome.artifactPaths,
          turns: turn,
        });
        return {
          status: "max_turns",
          summary,
          artifactPaths: outcome.artifactPaths,
          turns: turn,
        };
      }

      const history = await loadConversationMessages({
        workPath: input.workPath,
        conversationId: input.conversationId,
      });
      const historyText = formatConversationForOrchestrator(history);
      const gate = evaluateObjectiveCompletion(outcome);

      if (gate.passed && lastReply.trim()) {
        const completion = await checkSessionCompletion({
          goal,
          outcome,
          lastReply,
          historyText,
          turn,
          maxTurns,
          signal,
        });
        if (completion.kind === "completed") {
          return completion.result;
        }
        if (completion.kind === "misaligned" && !continueHint) {
          continueHint = buildContinueHint(completion.reason, outcome.artifactPaths);
        }
      }

      emitDelegate({
        type: "delegate_status",
        status: "planning",
        turn,
        maxTurns,
        artifactPaths: outcome.artifactPaths,
        goal,
      });

      const decision = await resolveSendDecision({
        goal,
        turn,
        maxTurns,
        artifactPaths: outcome.artifactPaths,
        gatePassed: gate.passed,
        gateReason: gate.reason,
        historyText,
        lastReply,
        forceContinue: continueHint,
        signal,
      });
      continueHint = undefined;

      if (decision.action === "escalate") {
        const summary =
          decision.questionForUser?.trim() ||
          decision.reason?.trim() ||
          "需要用户介入后继续。";
        emitDelegate({
          type: "delegate_complete",
          status: "escalated",
          summary,
          artifactPaths: outcome.artifactPaths,
          turns: turn,
        });
        return {
          status: "escalated",
          summary,
          artifactPaths: outcome.artifactPaths,
          turns: turn,
        };
      }

      if (decision.action === "complete") {
        const completion = await checkSessionCompletion({
          goal,
          outcome,
          lastReply,
          historyText,
          turn,
          maxTurns,
          summaryOverride: decision.summary,
          signal,
        });
        if (completion.kind === "completed") {
          return completion.result;
        }

        continueHint =
          completion.kind === "misaligned"
            ? buildContinueHint(completion.reason, outcome.artifactPaths)
            : "验收未通过，请 send 继续推进。";
        continue;
      }

      const nextTurn = turn + 1;
      const message = decision.message!.trim();

      emitDelegate({
        type: "delegate_turn",
        turn: nextTurn,
        message,
        rationale: decision.rationale,
      });

      emitDelegate({
        type: "delegate_status",
        status: "running",
        turn: nextTurn,
        maxTurns,
        artifactPaths: outcome.artifactPaths,
        goal,
      });

      let agentResult: AgentRunResult;
      try {
        agentResult = await runLocalAgent({
          workPath: input.workPath,
          conversationId: input.conversationId,
          message,
          mode: "normal",
          humanMessageKwargs: buildDelegateTurnKwargs({
            sessionId,
            turn: nextTurn,
          }),
          manageActivityEmitter: false,
          onActivity: input.onActivity,
        });
      } catch (error) {
        const handled = handleDelegateAgentError(
          error,
          outcome.artifactPaths,
          nextTurn,
        );
        if (handled) return handled;
        throw error;
      }

      lastReply = agentResult.reply;
      outcome = mergeSessionOutcome(outcome, agentResult.activityLog);
      turn = nextTurn;

      const historyAfter = await loadConversationMessages({
        workPath: input.workPath,
        conversationId: input.conversationId,
      });
      const historyTextAfter = formatConversationForOrchestrator(historyAfter);
      const completion = await checkSessionCompletion({
        goal,
        outcome,
        lastReply,
        historyText: historyTextAfter,
        turn,
        maxTurns,
        signal,
      });
      if (completion.kind === "completed") {
        return completion.result;
      }
      if (completion.kind === "misaligned") {
        continueHint = buildContinueHint(completion.reason, outcome.artifactPaths);
      }

      emitDelegate({
        type: "delegate_status",
        status: "running",
        turn,
        maxTurns,
        artifactPaths: outcome.artifactPaths,
        goal,
      });
    }

    const summary = "托管已暂停。";
    emitDelegate({
      type: "delegate_complete",
      status: "paused",
      summary,
      artifactPaths: outcome.artifactPaths,
      turns: turn,
    });
    return {
      status: "paused",
      summary,
      artifactPaths: outcome.artifactPaths,
      turns: turn,
    };
  } catch (error) {
    const handled = handleDelegateAgentError(
      error,
      outcome.artifactPaths,
      turn,
    );
    if (handled) return handled;

    const agentError = toAgentRunError(error);
    const summary = formatClassifiedErrorMessage(agentError);
    emitDelegate({
      type: "error",
      source: "llm",
      kind: agentError.kind,
      message: agentError.userMessage,
      suggestion: agentError.suggestion,
      detail: agentError.raw,
    });
    emitDelegate({
      type: "delegate_complete",
      status: "failed",
      summary,
      artifactPaths: outcome.artifactPaths,
      turns: turn,
    });
    return {
      status: "failed",
      summary,
      artifactPaths: outcome.artifactPaths,
      turns: turn,
    };
  } finally {
    setAgentActivityEmitter(null);
    activeDelegateAbort = null;
  }
}
