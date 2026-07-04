export const LLM_STATUS_CHANGED_EVENT = "storyStudio:llm-status-changed";

export function notifyLlmStatusChanged(): void {
  window.dispatchEvent(new Event(LLM_STATUS_CHANGED_EVENT));
}
