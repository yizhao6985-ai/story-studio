import type { HistoryChatMessage } from "#agent/messages/history.js";

export const DEFAULT_DELEGATE_MAX_TURNS = 10;

export function buildOrchestratorSystemPrompt(): string {
  return `你是「托管指挥」——代表用户自动驱动 Story Studio（内容创作 Agent）完成托管目标，不是 Story Studio 本身。

职责：
- 根据托管目标与对话历史，生成下一条发给 Story Studio 的用户消息
- 判断是否可以结束托管（仅当系统告知已有落盘产出时）
- 在无法代答或需要用户确认创作决策时请求暂停

规则：
- 生成的 message 应像真人用户：短、具体、可执行；一次只推进一件事（如「先读第三章再根据大纲补写结尾」）
- 禁止替 Story Studio 写正文、禁止描述工具调用细节
- 客观完成校验已通过时，若目标确已达成，应优先 complete，不要无意义 send
- action 为 complete 时，必须确认目标已有实际文件产出且与目标一致
- 若 Story Studio 在等用户做无法代劳的选择（情节、立场、删改幅度等），用 escalate
- 禁止在尚无落盘产出时 complete`;
}

export function formatConversationForOrchestrator(
  history: HistoryChatMessage[],
): string {
  if (history.length === 0) return "（尚无对话）";

  return history
    .map((item) => {
      if (item.role === "user") return `用户：${item.text}`;
      if (item.role === "delegate") {
        return `代理（第 ${item.turn} 轮）：${item.text}`;
      }
      return `Story Studio：${item.text}`;
    })
    .join("\n\n");
}

export function buildOrchestratorDecidePrompt(input: {
  goal: string;
  turn: number;
  maxTurns: number;
  artifactPaths: string[];
  gatePassed: boolean;
  gateReason: string;
  historyText: string;
  lastReply?: string;
  forceContinue?: string;
}): string {
  const artifactBlock =
    input.artifactPaths.length > 0
      ? input.artifactPaths.join("、")
      : "（尚无）";

  const sections = [
    `托管目标：${input.goal}`,
    `当前轮次：${input.turn}/${input.maxTurns}`,
    `累计产出文件：${artifactBlock}`,
    `客观完成校验：${input.gatePassed ? "已通过" : "未通过"}（${input.gateReason}）`,
    "",
    "对话历史：",
    input.historyText,
  ];

  if (input.lastReply?.trim()) {
    sections.push("", "Story Studio 上一轮回复：", input.lastReply.trim());
  }

  if (input.forceContinue?.trim()) {
    sections.push("", "系统提示：", input.forceContinue.trim());
  }

  sections.push(
    "",
    "请决定下一步：send（发消息给 Story Studio）、complete（目标已完成）、escalate（需用户介入）。",
  );

  return sections.join("\n");
}

export function buildOrchestratorAlignmentPrompt(input: {
  goal: string;
  artifactPaths: string[];
  lastReply: string;
  historyText: string;
}): string {
  return [
    `托管目标：${input.goal}`,
    `产出文件：${input.artifactPaths.join("、")}`,
    "",
    "对话历史：",
    input.historyText,
    "",
    "Story Studio 上一轮回复：",
    input.lastReply.trim(),
    "",
    "判断：这些产出与对话是否已满足托管目标？",
  ].join("\n");
}
