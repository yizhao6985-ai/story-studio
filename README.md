# Story Studio

AI 桌面故事创作工具：本地作品库 + Git 版本 + 多模式 AI 协作（提问 / 创作）。

## Monorepo 结构

```
story-studio/
├── apps/
│   ├── desktop/            # Electron 桌面客户端 (:5175)
│   │   └── electron/mcp/   # 本地 MCP 文件服务 (:3100)
│   └── langgraph-service/  # LangGraph 官方 API (:2024)
├── packages/
│   ├── shared/
│   └── workspace-fs/
└── ...
```

## 架构

```
Renderer ──useStream──► langgraph dev (:2024)
                              │
                              └── MCP HTTP + Bearer token
                                    └── Electron MCP (:3100/mcp)
                                          └── workspace-fs (workPath 经请求头注入)

对话列表 / checkpoint ── LangGraph threads API（metadata: workPath, mode, title）
文件读写 ── Electron MCP（LangGraph 通过 configurable.workPath → MCP 请求头）
```

**Electron 一体化启动**：打开 Desktop 时会自动启动 MCP 与 LangGraph 子进程（若 :2024 已有服务则复用，适用于 `pnpm dev` 并行模式）。

## 快速开始

```bash
pnpm install

# 配置 LLM Key
cp apps/langgraph-service/.env.example apps/langgraph-service/.env
# 编辑 DEEPSEEK_API_KEY

# 仅 Desktop（Electron 内嵌启动 LangGraph）
pnpm dev:desktop

# 或并行（turbo 会同时起 langgraph-service，Desktop 自动复用 :2024）
pnpm dev
```

## 环境变量

`apps/langgraph-service/.env`：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 是 | LLM API Key |
| `LANGSMITH_API_KEY` | 推荐 | LangSmith API Key，用于 trace 与 Studio 调试 |
| `LANGSMITH_TRACING` | 推荐 | 设为 `true` 开启 LangSmith 追踪 |
| `LANGSMITH_PROJECT` | 否 | LangSmith 项目名，默认 `default` |
| `STORY_STUDIO_MCP_URL` | 独立 dev 时建议填写 | 默认 `http://127.0.0.1:3100/mcp`（需先启动 Desktop MCP） |
| `STORY_STUDIO_MCP_TOKEN` | 独立 dev 时建议填写 | 默认 `dev-local-token`，与 Electron 开发模式一致 |
| `STORY_STUDIO_USER_DATA` | 否 | Electron 自动注入 userData 路径 |

Desktop 开发可选：

| 变量 | 说明 |
|------|------|
| `STORY_STUDIO_SKIP_EMBEDDED_LANGGRAPH=1` | 禁止 Electron 内嵌 spawn LangGraph |
| `VITE_LANGGRAPH_API_URL` | 跳过 API 发现，直连指定 URL |

## 安全与数据

- MCP 仅监听 `127.0.0.1`，需 Bearer token
- `workPath` 通过 HTTP 头 `x-story-studio-work-path` 传递，非全局状态
- 对话 mode 在创建时写入 thread metadata，已有对话不可切换模式
- LangGraph checkpoint 存储于 `apps/langgraph-service/.langgraph_api/`（开发）或 userData（内嵌运行时）

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 并行启动 LangGraph + Desktop |
| `pnpm dev:agent` | 仅 `langgraphjs dev`（:2024） |
| `pnpm dev:desktop` | Electron + MCP + 内嵌 LangGraph |
| `pnpm check-types` | 类型检查 |
