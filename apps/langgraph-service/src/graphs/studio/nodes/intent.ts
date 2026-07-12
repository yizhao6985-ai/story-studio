import { generateStructuredOutput } from "../../../llm/structured-output.js";
import { createChatModel } from "../../../platform/llm.js";
import type { SubTask } from "@story-studio/shared/task-types";
import { formatIntentPrompt } from "../prompts.js";
import { userIntentSchema } from "../schemas.js";
import type { StudioGraphState } from "../state.js";

const INTENT_SYSTEM = `你是 Story Studio 意图分析器。
将用户消息拆解为有序子任务列表。只输出合法 JSON，不要 markdown 代码块。
每个 subTask 必须包含 type 与 goal 字段；goal 不可省略。
read 是 ask 与 edit 共用的信息收集阶段；answer 是 ask 路径终点；create / edit / delete 是 edit 路径。
提问模式下禁止 create / edit / delete 子任务。`;

const ANSWER_TYPES = new Set(["read", "answer"]);
const MUTATION_TYPES = new Set(["create", "edit", "delete"]);

function isAnswerPathTask(task: SubTask): boolean {
  return ANSWER_TYPES.has(task.type);
}

function isMutationTask(task: SubTask): boolean {
  return MUTATION_TYPES.has(task.type);
}

function filterTasksForMode(tasks: SubTask[], mode: "ask" | "normal"): SubTask[] {
  if (mode === "normal") return tasks;

  const allowed = tasks.filter(isAnswerPathTask);
  const blocked = tasks.filter(isMutationTask);

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
  if (!state.userMessage) {
    throw new Error("USER_MESSAGE_MISSING");
  }

  const model = createChatModel({ temperature: 0.1 });
  const intent = await generateStructuredOutput(
    model,
    formatIntentPrompt(state.userMessage, state.mode ?? "normal", state.projectContext),
    userIntentSchema,
    INTENT_SYSTEM,
    { name: "analyze_intent" },
  );

  return {
    intent: {
      ...intent,
      clarificationQuestion: intent.clarificationQuestion ?? undefined,
      subTasks: intent.subTasks.map((task) => ({
        ...task,
        scope: task.scope ?? undefined,
        targets: task.targets ?? undefined,
      })),
    },
  };
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

export function routeDispatch(
  state: StudioGraphState,
): "read" | "answer" | "edit" | "summarize" {
  const task = state.taskQueue[state.taskIndex];
  if (!task) return "summarize";

  switch (task.type) {
    case "read":
      return "read";
    case "answer":
      return "answer";
    case "create":
    case "edit":
    case "delete":
      return "edit";
  }
}

export async function advanceTaskNode(
  state: StudioGraphState,
): Promise<Partial<StudioGraphState>> {
  return { taskIndex: state.taskIndex + 1 };
}
