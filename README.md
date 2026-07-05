# Story Studio

AI 桌面故事创作工具：本地作品库 + Git 版本 + 多模式 AI 协作（提问 / 创作 / 托管）。

## Monorepo 结构

```
story-studio/
├── apps/
│   ├── desktop/          # Electron 桌面客户端 (:5175)
│   └── mastra-service/   # 独立 Mastra Agent 服务 (:4111)
├── packages/
│   ├── shared/           # 共享类型与工具
│   └── workspace-fs/     # 作品目录读写（Mastra 与 Electron 共用）
├── turbo.json            # Turborepo 任务编排
├── pnpm-workspace.yaml
└── package.json
```

## 架构

```
Renderer ──IPC──► Electron Main ──HTTP/NDJSON──► Mastra Service (/mastra)
Mastra Service ──直接 fs──► 作品目录 (workPath)
Electron Main ──IPC──► workspace-fs ──► 作品目录 (编辑器)
```

- **Mastra Service**（`apps/mastra-service`）：独立进程，Agent 编排、Memory、Streaming、Tool 执行；API 前缀 `/mastra`；LLM 凭据通过本地环境变量配置
- **Electron Main**（`apps/desktop`）：IPC 网关、Mastra HTTP 代理、原生能力（目录选择、窗口）
- **workspace-fs**（`packages/workspace-fs`）：作品目录读写，Mastra tools 与 Electron 编辑器共用
- **Renderer**：纯 UI，不直接访问 Agent 或文件系统
- **Shared**（`packages/shared`）：跨 app 共享的类型与工具

## 快速开始

```bash
pnpm install
pnpm dev          # 并行启动 Mastra Service + Electron
```

或分别启动：

```bash
pnpm dev:mastra   # Mastra Studio + API (http://localhost:4111/mastra)
pnpm dev:desktop  # Electron (:5175)
```

在 `apps/mastra-service` 复制 `.env.example` 为 `.env`，填写 `DEEPSEEK_API_KEY` 后即可使用。

## 常用命令

Monorepo 使用 [Turborepo](https://turbo.build/)（`turbo`，**不是** Next.js 的 Turbopack）编排任务：构建缓存、依赖顺序、并行 dev。

`pnpm dev` 会打开 **TUI 终端界面**：左侧为服务列表，右侧为选中服务的日志；用 `↑`/`↓` 切换，`/` 搜索任务。

| 命令 | 说明 |
|------|------|
| `pnpm dev` | TUI 并行启动 Mastra Service + Desktop |
| `pnpm dev:mastra` | 仅 Mastra Service |
| `pnpm dev:desktop` | 仅 Electron 桌面 |
| `pnpm check-types` | 全仓库类型检查（先 shared，再 apps） |
| `pnpm build` | 构建 Mastra Service + Desktop（带缓存） |
| `pnpm package:desktop` | 打包桌面应用（内含 Mastra 子进程） |
| `pnpm lint` | ESLint（desktop） |

若需传统混流日志（无分栏），可运行 `turbo run dev --ui=stream`。

## LLM 配置（环境变量）

Mastra Service 从本地环境变量读取 LLM 凭据（见 `apps/mastra-service/.env.example`）：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek / OpenAI 兼容 API Key |
| `STORY_STUDIO_LLM_BASE_URL` | 否 | Base URL（默认 `https://api.deepseek.com`） |
| `STORY_STUDIO_CHAT_MODEL` | 否 | 聊天模型（默认 `deepseek-chat`） |

Middleware 启动时将上述变量写入 `requestContext`，Agent 运行时解析为 OpenAI 兼容调用。

## 运行时注册

Electron 启动后会向 Mastra 注册本地运行时信息（`POST /mastra/studio/runtime/register`）：

| 字段 | 说明 |
|------|------|
| `userDataRoot` | Electron userData 路径（Memory DB、对话 manifest） |

也可通过环境变量 `STORY_STUDIO_USER_DATA` 配置（适用于独立部署 Mastra）。

## 桌面打包

打包产物为单个安装包，运行时由 Electron Main 以 sidecar 子进程拉起 Mastra（`ELECTRON_RUN_AS_NODE`），无需用户单独安装 Node 或启动 Mastra。

```bash
pnpm package:desktop
```

产物输出到 `apps/desktop/release/`。流程：

1. `mastra build` → `apps/mastra-service/.mastra/output/`
2. `vite build` → 渲染进程 + Electron Main
3. `electron-builder` → 将 Mastra 产物放入 `resources/mastra/`

**LLM 凭据（打包后）**：在 Electron `userData` 目录创建 `.env` 文件，写入 `DEEPSEEK_API_KEY=sk-...`（与开发时 `apps/mastra-service/.env` 相同格式）。Main 启动 Mastra 子进程时会自动注入。

开发环境仍保持双进程：`pnpm dev` 并行启动 Mastra + Electron，Main 不 spawn Mastra。

## 环境变量

| 变量 | 说明 |
|------|------|
| `STORY_STUDIO_MASTRA_URL` | Mastra 服务地址（默认 `http://127.0.0.1:4111`） |
| `DEEPSEEK_API_KEY` | LLM API Key（Mastra Service 必填） |
| `STORY_STUDIO_LLM_BASE_URL` | LLM Base URL（可选） |
| `STORY_STUDIO_CHAT_MODEL` | 聊天模型（可选） |
| `STORY_STUDIO_USER_DATA` | Memory DB 根目录（可选，Electron 会注册） |
