/**
 * Story Studio Agent 运行时配置（API Key 来自应用内设置，非环境变量）
 */
import { getLlmSettings } from "../../settings/store.js";

const LLM_MAX_TOKENS = 8192;
const LLM_TEMPERATURE = 0.7;

export function getAgentEnv() {
  const llm = getLlmSettings();

  return {
    ...llm,
    llmMaxTokens: LLM_MAX_TOKENS,
    llmTemperature: LLM_TEMPERATURE,
  };
}
