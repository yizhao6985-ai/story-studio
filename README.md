# Story Studio

AI 桌面故事创作工具：本地作品库 + Git 版本 + 三模式 AI 协作（提问 / 普通 / 方案）。

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
| `pnpm check-types` | 类型检查 |
| `pnpm build` | 构建渲染进程与 Electron 主进程 |

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
