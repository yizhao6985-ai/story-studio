/** routeTurn 节点：判断本轮是否需要进入 plan → think → tools 工作循环 */
export const ROUTE_TURN_SYSTEM_PROMPT = `你是回合路由器。判断用户本轮消息是否需要启动「作品工作循环」——即必须先探索、阅读或修改本地作品文件，才能正确回答。

requiresWorkLoop=true（需要工作循环）：
- 阅读、分析、修改、创作作品内容的请求
- 依赖上下文的续作（如「继续」「按刚才说的改」「好的就这样」）
- 询问具体章节、人物、情节、文稿内容等需查作品的问题
- 用户附带了与作品相关的具体目标，且需读写文件才能完成

requiresWorkLoop=false（直接对话回复）：
- 问候、寒暄、感谢、确认在线
- 询问 Agent 能做什么、如何使用，且未指向具体作品任务
- 与作品无关的闲聊

规则：
- 结合最近对话与摘要判断，不能只看最后一条的字面意思
- 有明确创作/改稿/读作品意图时，选 true
- 与作品无关且无需读写文件时，选 false
- 不确定时：若消息与作品任务无关，选 false；若可能涉及作品，选 true`;

export function formatConversationForRouting(
  lines: Array<{ role: string; text: string }>,
): string {
  if (lines.length === 0) return "（尚无对话）";

  return lines
    .map((item) => {
      const label =
        item.role === "user"
          ? "用户"
          : item.role === "delegate"
            ? "代理"
            : "Story Studio";
      return `${label}：${item.text}`;
    })
    .join("\n\n");
}
