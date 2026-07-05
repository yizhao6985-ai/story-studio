import type { AgentMode } from "../../../../src/lib/story/types.js";
import type { WorkLoopState } from "#agent/shared/work-loop/types.js";

/** synthesize 空回复或 checkpoint 丢失正文时的兜底汇总。 */
export function buildSynthesizeFallbackReply(
  workLoop: WorkLoopState,
  _mode: AgentMode = "normal",
): string {
  const lines: string[] = ["本轮已完成以下工作："];

  if (workLoop.subtasks.length > 0) {
    for (const [i, subtask] of workLoop.subtasks.entries()) {
      const mark =
        subtask.status === "done"
          ? "✓"
          : subtask.status === "failed"
            ? "✗"
            : "·";
      lines.push(`${mark} ${i + 1}. ${subtask.intent}`);
    }
  }

  const touchedPaths = [
    ...new Set(
      workLoop.activityLog
        .filter((e) => e.path && (e.stage === "act" || e.stage === "verify"))
        .map((e) => e.path!),
    ),
  ];
  if (touchedPaths.length > 0) {
    lines.push("", "涉及文件：", ...touchedPaths.map((p) => `- ${p}`));
  }

  const verifyOk = workLoop.activityLog.some(
    (e) => e.stage === "verify" && e.status === "done",
  );
  if (verifyOk) {
    lines.push("", "写入已通过校验。");
  }

  lines.push("", "如需我继续展开某部分或进入下一步，告诉我就行。");
  return lines.join("\n");
}

export const EMPTY_ASSISTANT_REPLY = "（无回复）";

export function isEmptyAssistantReply(reply: string): boolean {
  return !reply.trim() || reply.trim() === EMPTY_ASSISTANT_REPLY;
}
