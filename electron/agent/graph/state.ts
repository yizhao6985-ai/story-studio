/**
 * Story Studio 本地 Agent 运行时状态（LangGraph Checkpoint State）
 *
 * 每个对话（conversationId）对应一条 graph thread，状态持久化到作品目录下的 checkpointer。
 * 用户每发一条消息，runner 注入 patch 后跑一轮 workflow（见 workflow.ts）：
 *
 *   START → prepareTurn → compactContext → routeTurn
 *            ├─ direct → synthesize → END
 *            └─ workLoop → planTasks → think
 *                 ↕ executeTools / advanceSubtask / escalate / synthesize → END
 *
 * 各节点通过返回 Partial<AgentState> 增量更新本文件定义的字段；messages 由 LangGraph
 * 的 messagesStateReducer 追加合并（含 human / ai / tool / 内部 think 等）。
 */
import {
  Annotation,
  MessagesAnnotation,
  messagesStateReducer,
} from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { AgentMode } from "../../../src/lib/story/types.js";

import type { WorkLoopState } from "#agent/shared/work-loop/types.js";
import type { ContextUsageSnapshot } from "#agent/messages/context-usage.js";

/** 本轮路由：direct 直出 synthesize；workLoop 进入 plan → think → tools */
export type TurnRoute = "direct" | "workLoop";

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,

  /**
   * 完整对话 transcript，checkpoint 跨轮次保留。
   *
   * - runner 每轮追加一条 HumanMessage
   * - think / synthesize 追加 AI 回复；executeTools 追加 tool 结果
   * - turn activity 等内部消息也落在这里，但 selectMessagesForLlm 会过滤后再送 LLM
   *
   * reducer：messagesStateReducer（按 message.id 去重/合并，新消息 append）
   */
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  /**
   * 当前作品根目录绝对路径。
   *
   * runner 每轮传入；工具读写文件、conversation store 均以此为 scope。
   * 同一 thread 内通常不变。
   *
   * reducer：直接覆盖（last-write-wins）
   */
  workPath: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  /**
   * 用户选择的 Agent 模式，决定可用工具集与 system prompt 风格：
   *
   * - "ask"    — 只读问答，无写文件工具
   * - "normal" — 完整创作循环（读→定位→写→校验）
   * - "scheme" — 方案/大纲模式
   *
   * runner 每轮传入；影响 planTasks / think / tool-gate / context 预算估算。
   *
   * reducer：直接覆盖，缺省回退 "normal"
   */
  mode: Annotation<AgentMode>({
    reducer: (_prev, next) => next ?? "normal",
    default: () => "normal",
  }),

  /**
   * 单轮（single turn）工作循环内存，不跨用户消息持久化意图。
   *
   * prepareTurn 每轮重置为 createInitialWorkLoop() 与 turnRoute=null；随后 routeTurn 写入路由，
   * planTasks 写入 subtasks，
   * think/executeTools/advanceSubtask 更新 stepCount、readCache、pinnedTargets、
   * activityLog 等。UI 通过 runner 流式读取 activityLog / subtasks 展示进度。
   *
   * reducer：有 next 用 next，否则保留 prev（节点可局部返回 null 表示不改动）
   */
  workLoop: Annotation<WorkLoopState | null>({
    reducer: (_prev, next) => next ?? _prev ?? null,
    default: () => null,
  }),

  /**
   * 本轮路由结果，由 routeTurn 写入；prepareTurn 每轮重置为 null。
   *
   * - "direct"   — 无需读写作品，compactContext 后直出 synthesize
   * - "workLoop" — 进入 planTasks → think ↔ executeTools → synthesize
   */
  turnRoute: Annotation<TurnRoute | null>({
    reducer: (_prev, next) => (next !== undefined ? next : (_prev ?? null)),
    default: () => null,
  }),

  /**
   * 较早对话的 LLM 生成摘要，用于 context 压缩（compactContext 节点）。
   *
   * 当 token 使用率超过阈值时，compactContext 把「最近 N 轮窗口」之外的消息
   * 压成摘要；selectMessagesForLlm 将其作为 SystemMessage 插在可见历史之前，
   * 使 LLM 仍能感知早期目标/决策/路径，而不携带全文。
   *
   * reducer：显式传入 undefined 时保留旧值（允许节点只更新其他字段）
   */
  conversationSummary: Annotation<string | null>({
    reducer: (_prev, next) => (next !== undefined ? next : (_prev ?? null)),
    default: () => null,
  }),

  /**
   * 摘要已覆盖到的最后一条 message.id（summary 截止锚点）。
   *
   * selectMessagesForLlm 会跳过该 id 及之前的原始消息，只保留摘要 + 后续全文，
   * 与 conversationSummary 成对使用。compactContext 在压缩成功时更新。
   *
   * reducer：同 conversationSummary
   */
  summaryThroughMessageId: Annotation<string | null>({
    reducer: (_prev, next) => (next !== undefined ? next : (_prev ?? null)),
    default: () => null,
  }),

  /**
   * 最近一次估算的 context 占用快照，供 UI Context 用量条展示。
   *
   * compactContext 每轮刷新（无论是否触发压缩）；runner.getAgentContextUsage
   * 也可在草稿输入时实时估算。不参与 LLM 推理逻辑本身。
   *
   * reducer：同 conversationSummary
   */
  contextUsage: Annotation<ContextUsageSnapshot | null>({
    reducer: (_prev, next) => (next !== undefined ? next : (_prev ?? null)),
    default: () => null,
  }),
});

/** LangGraph 推断出的完整状态类型，节点签名与 selectMessagesForLlm 等工具函数使用 */
export type AgentStateType = typeof AgentState.State;

/** 节点返回值类型：任意字段可选，未返回的字段由 reducer 规则合并 */
export type AgentStatePatch = Partial<AgentStateType>;
