import { generateStructuredOutput } from "../../../llm/structured-output.js";
import { createChatModel } from "../../../platform/llm.js";
import type { SubTask } from "@story-studio/shared/task-types";
import { formatIntentPrompt } from "../prompts.js";
import { userIntentSchema } from "../schemas.js";
import type { StudioGraphState } from "../state.js";

const INTENT_SYSTEM = `你是 Story Studio 意图分析器。
将用户消息拆解为有序子任务列表。只输出合法 JSON。
提问模式下禁止 create / edit / delete 子任务。`;

const ASK_ONLY_TYPES = new Set(["read", "answer"]);
const EDIT_TYPES = new Set(["create", "edit", "delete"]);

function isAskTask(task: SubTask): boolean {
  return ASK_ONLY_TYPES.has(task.type);
}

function isEditTask(task: SubTask): boolean {
  return EDIT_TYPES.has(task.type);
}

function filterTasksForMode(tasks: SubTask[], mode: "ask" | "normal"): SubTask[] {
  if (mode === "normal") return tasks;

  const allowed = tasks.filter(isAskTask);
  const blocked = tasks.filter(isEditTask);

  if (blocked.length === 0) return allowed;

  return [
    ...allowed,
    {
      type: "answer",
      goal: `用户请求了文件修改（${blocked.map((task) => task.goal).join("；")}），但当前为提问模式，无法执行。请说明需要切换到创作模式。`,
    },
  ];
}

export async function analyzeIntentNode(
  state: StudioGraphState,
): Promise<Partial<StudioGraphState>> {
  const model = createChatModel({ temperature: 0.1 });
  const intent = await generateStructuredOutput(
    model,
    formatIntentPrompt(state.userMessage, state.mode ?? "normal"),
    userIntentSchema,
    INTENT_SYSTEM,
  );

  return { intent };
}

export async function generateTasksNode(
  state: StudioGraphState,
): Promise<Partial<StudioGraphState>> {
  if (!state.intent) {
    throw new Error("INTENT_MISSING");
  }

  if (state.intent.needsClarification) {
    return { taskQueue: [], taskIndex: 0, taskResults: [] };
  }

  const taskQueue = filterTasksForMode(
    state.intent.subTasks,
    state.mode ?? "normal",
  );

  return {
    taskQueue,
    taskIndex: 0,
    taskResults: [],
  };
}

export function routeAfterGenerate(state: StudioGraphState): "clarify" | "dispatch" {
  if (state.intent?.needsClarification) return "clarify";
  return "dispatch";
}

export function routeDispatch(state: StudioGraphState): "ask" | "edit" | "summarize" {
  const task = state.taskQueue[state.taskIndex];
  if (!task) return "summarize";
  return isEditTask(task) ? "edit" : "ask";
}

export async function advanceTaskNode(
  state: StudioGraphState,
): Promise<Partial<StudioGraphState>> {
  return { taskIndex: state.taskIndex + 1 };
}
