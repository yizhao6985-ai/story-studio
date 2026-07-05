import { cancelDelegateSession } from "./delegate.js";
import { cancelLocalAgent, waitForActiveAgentRun } from "./run.js";

const AGENT_DRAIN_TIMEOUT_MS = 3_000;

/** 在 Mastra 关闭 storage 前取消并等待进行中的 agent 任务，避免 WAL checkpoint 遇到 SQLITE_BUSY。 */
export async function prepareAgentShutdown(): Promise<void> {
  cancelDelegateSession();
  cancelLocalAgent();
  await waitForActiveAgentRun(AGENT_DRAIN_TIMEOUT_MS);
}
