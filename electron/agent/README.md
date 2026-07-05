# Story Studio 本地 Agent（内嵌于 desktop）

LangGraph work-loop：`prepareTurn → compactContext → routeTurn → planTasks → think ↔ executeTools → synthesize`

`think` 在子任务未完成且无 tool call 时会有限次自循环（最多 2 次）；`planTasks` 默认合并为 1 个子任务。

无作品任务时（`routeTurn` 判定为 direct）：`prepareTurn → compactContext → routeTurn → synthesize`

## 目录结构

按 **LangGraph 节点/流程** 组织：每个图节点有独立目录，跨节点共享逻辑放在 `shared/`。

```text
agent/
├── runtime/              # 进程入口、work 级 graph 缓存、UI 活动事件
│   ├── runner.ts
│   ├── work-graph.ts
│   └── activity.ts
├── graph/                # LangGraph 图定义（不含节点实现）
│   ├── workflow.ts
│   ├── state.ts
│   └── checkpointer.ts
├── nodes/                # 各图节点 + 条件路由
│   ├── routes.ts         # routeAfterThink / Execute / Advance
│   ├── utils.ts          # 节点间共享小工具
│   ├── prepare-turn/
│   ├── route-turn/       # index.ts + prompt.ts（回合路由）
│   ├── plan-tasks/       # index.ts + plan.ts + prompt.ts
│   ├── think/            # index.ts + prompt.ts
│   ├── execute-tools/    # + post-update.ts（工具后状态更新与 verify）
│   ├── advance-subtask/  # + subtasks.ts
│   ├── synthesize/       # index.ts + prompt.ts
│   ├── compact-context/  # index.ts + prompt.ts
│   └── escalate/
├── shared/
│   ├── system-prompt.ts  # Story Studio 身份壳层（think/synthesize 共用）
│   └── work-loop/        # WorkLoopState、工具门控、活动日志
├── tools/                # LangChain 工作区工具定义
├── llm/                  # 模型与调用
├── messages/             # 消息序列化与 LLM 输入准备
└── runtime/delegate/     # 托管运行时 + prompt.ts
```

各节点/模块的 `prompt.ts` 与 `index.ts` 同目录，改提示词时就近查看；think/synthesize 共用的身份壳层在 `shared/system-prompt.ts`。

## 执行循环

```text
prepareTurn    # 重置 workLoop / turnRoute，不预读目录
compactContext # 上下文超阈值时压缩较早对话
routeTurn      # 判断是否需要作品工作循环；否 → 直出 synthesize
planTasks      # 外层任务规划（默认 1 条 subtask；读+写+整合合并）
think          # 针对当前子任务决定 tool；非法 tool 名在节点内过滤/别名映射
executeTools   # 探索 / 读 / 写 + 自动 verify
advanceSubtask # 多子任务且当前项已有活动时切换下一项
synthesize     # 独立上下文生成用户可见汇总（不复述用户原话）
```

## 阶段与动作

- **探索**：`explore_workspace`（含浏览根目录 path=""）、`glob`、`grep`
- **读取**：`read_workspace_file`
- **定位**：`pin_write_target`（Normal）
- **写入**：`patch` / `write` / `create` / `delete` / `rename_workspace_entry`（Normal）
- **验证**：write 后 runtime 自动 read-back

## 对话历史

- 每轮用户消息对应 **一条** assistant 气泡（中间 think / tool 消息不展示）
- 最终回复的 `additional_kwargs` 持久化 `activityLog` 与 `subtasks`，重开对话可展开执行过程
