import { AIMessage } from "@langchain/core/messages";

import { buildAssistantTurnKwargs } from "#agent/messages/turn-meta.js";
import type { AgentStatePatch, AgentStateType } from "#agent/graph/state.js";

export async function escalateNode(
  state: AgentStateType,
): Promise<AgentStatePatch> {
  const workLoop = state.workLoop!;
  const reason =
    workLoop.escalateReason ??
    "这一步我还缺少关键创作信息。你可以说具体一点：要改哪个文件、哪一段，或希望达到什么效果。";

  return {
    messages: [
      new AIMessage({
        content: reason,
        additional_kwargs: buildAssistantTurnKwargs({
          activityLog: workLoop.activityLog,
          subtasks: workLoop.subtasks.map((s) => ({
            id: s.id,
            intent: s.intent,
            status: s.status,
          })),
        }),
      }),
    ],
  };
}
