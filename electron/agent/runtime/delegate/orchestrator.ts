import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

import { createChatModel } from "#agent/llm/chat-model.js";
import { invokeStructured } from "#agent/llm/structured.js";
import {
  buildOrchestratorAlignmentPrompt,
  buildOrchestratorDecidePrompt,
  buildOrchestratorSystemPrompt,
} from "#agent/runtime/delegate/prompt.js";

const DecideSchema = z.object({
  action: z.enum(["send", "complete", "escalate"]),
  message: z.string().optional(),
  rationale: z.string().optional(),
  summary: z.string().optional(),
  reason: z.string().optional(),
  questionForUser: z.string().optional(),
});

const AlignmentSchema = z.object({
  aligned: z.boolean(),
  summary: z.string().min(1),
});

export type OrchestratorDecision = z.infer<typeof DecideSchema>;
export type OrchestratorAlignment = z.infer<typeof AlignmentSchema>;

export async function orchestratorDecide(
  input: Parameters<typeof buildOrchestratorDecidePrompt>[0],
  config?: RunnableConfig,
): Promise<OrchestratorDecision> {
  const llm = createChatModel({ temperature: 0.3 });
  const prompt = buildOrchestratorDecidePrompt(input);

  const parsed = await invokeStructured(
    llm,
    DecideSchema,
    [new SystemMessage(buildOrchestratorSystemPrompt()), new HumanMessage(prompt)],
    { name: "delegate_decide", maxAttempts: 2 },
    config,
  );

  if (parsed.action === "send") {
    const message = parsed.message?.trim();
    if (!message) {
      throw new Error("DELEGATE_EMPTY_MESSAGE");
    }
    return { ...parsed, message };
  }

  if (parsed.action === "complete") {
    const summary = parsed.summary?.trim();
    if (!summary) {
      throw new Error("DELEGATE_EMPTY_SUMMARY");
    }
    return { ...parsed, summary };
  }

  const reason = parsed.reason?.trim() || parsed.questionForUser?.trim();
  if (!reason) {
    throw new Error("DELEGATE_EMPTY_ESCALATION");
  }
  return {
    ...parsed,
    reason,
    questionForUser: parsed.questionForUser?.trim() || reason,
  };
}

export async function orchestratorEvaluateAlignment(
  input: Parameters<typeof buildOrchestratorAlignmentPrompt>[0],
  config?: RunnableConfig,
): Promise<OrchestratorAlignment> {
  const llm = createChatModel({ temperature: 0.2 });
  const prompt = buildOrchestratorAlignmentPrompt(input);

  return invokeStructured(
    llm,
    AlignmentSchema,
    [new SystemMessage(buildOrchestratorSystemPrompt()), new HumanMessage(prompt)],
    { name: "delegate_alignment", maxAttempts: 2 },
    config,
  );
}
