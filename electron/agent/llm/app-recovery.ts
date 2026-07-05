/** Agent 程序层接管后的用户可见文案（不含 LLM 原始报错） */

export const AGENT_RUN_DEGRADED_MESSAGE =
  "本轮未生成完整回复，AI 服务返回错误，详情请见下方红色提示。";

export const AGENT_ESCALATE_PREFIX =
  "无法继续执行当前步骤。AI 服务返回错误，请查看界面下方红色提示。";
