# Story Studio

AI 桌面故事创作工具：本地作品库 + Git 版本 + 多模式 AI 协作（提问 / 创作 / 托管）。

Electron 客户端在本地运行 LangGraph Agent 与作品库，用户在应用内配置 OpenAI 兼容 API Key。

## 快速开始

```bash
pnpm install
pnpm dev   # 首次启动在应用内配置 API Key
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | Story Studio 桌面开发（:5175） |
| `pnpm dev:langsmith` | 同上，并开启 LangSmith trace（读 `.env.local`） |
| `pnpm check-types` | 类型检查 |
| `pnpm build` | 构建渲染进程与 Electron 主进程 |

## LangSmith（开发调试）

Agent 跑在 Electron 主进程；LangChain / LangGraph 会通过环境变量自动上报 trace，**无需改 Agent 代码**。

1. 在 [smith.langchain.com](https://smith.langchain.com/settings) 创建 API Key（与作品内 LLM Key 无关）
2. 复制模板并填写 Key：

```bash
cp .env.example .env.local
# 编辑 .env.local 中的 LANGCHAIN_API_KEY
```

3. 任选一种启动方式：

```bash
# 便捷脚本（推荐）
pnpm dev:langsmith

# 或手动 export 后启动
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=lsv2_pt_xxx
export LANGCHAIN_PROJECT=story-studio-dev
pnpm dev
```

跑一轮对话后，在 LangSmith 项目 `story-studio-dev` 中可查看 LangGraph 节点、LLM 与 tool 调用链。`.env.local` 已在 `.gitignore` 中，不会提交。

## 作品存储

每部作品为本地文件夹下的 Git 仓库，可含 `README.md` 说明；对话 checkpoint 保存在本机 `userData/works/<hash>/agent.sqlite`，对话列表在 `userData/works/<hash>/conversations/index.json`。

## 架构

```
story-studio/
├── electron/          # 主进程：IPC、作品库、LangGraph Agent
├── src/               # 渲染进程：React UI
└── scripts/           # native 模块重建（better-sqlite3）
```

## 生产运行

```bash
pnpm build
electron dist-electron/main.js
```

正式安装包分发（electron-builder 等）可按需自行添加。
