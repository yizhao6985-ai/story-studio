import type { Layout } from "react-resizable-panels";

const STORAGE_KEY = "storyStudio.panelLayouts";

/** Electron 默认窗口宽度，用于推算首次打开的百分比默认值。 */
export const LAYOUT_REFERENCE_WIDTH = 1440;

export const PANEL_LAYOUT_IDS = {
  appShell: "app-shell",
  appContent: "app-content",
  workspaceFiles: "workspace-files",
} as const;

/** 侧栏目标宽度，与视觉设计一致。 */
export const SIDEBAR_TARGET_PX = 220;

/** 各区域最小宽度（像素），通过 Panel minSize 约束。 */
export const PANEL_MIN_PX = {
  sidebar: 200,
  main: 720,
  conversation: 340,
  /** 需容纳文件树 + 编辑器最小宽度 */
  workspace: 560,
  fileTree: 200,
  editor: 360,
} as const;

/** 各区域最大宽度（像素）。 */
export const PANEL_MAX_PX = {
  sidebar: 280,
  fileTree: 280,
  conversation: 640,
} as const;

/** 应用外壳：侧栏 vs 主内容区 */
export const DEFAULT_APP_SHELL_LAYOUT = {
  sidebar: 15,
  main: 85,
} as const;

export const COLLAPSED_APP_SHELL_LAYOUT = {
  sidebar: 0,
  main: 100,
} as const;

/**
 * 主内容区：对话 vs 工作区。
 * 以 1440×15% 侧栏估算，主区约 1224px，对话目标 ~440px → 36%。
 */
export const DEFAULT_APP_CONTENT_LAYOUT = {
  conversation: 36,
  workspace: 64,
} as const;

export const COLLAPSED_APP_CONTENT_LAYOUT = {
  conversation: 100,
  workspace: 0,
} as const;

/**
 * 工作区内部：文件树 vs 编辑器。
 * 工作区约 783px 时，文件树目标 ~240px → 31%。
 */
export const DEFAULT_WORKSPACE_FILES_LAYOUT = {
  "file-tree": 31,
  editor: 69,
} as const;

export const COLLAPSED_WORKSPACE_FILES_LAYOUT = {
  "file-tree": 0,
  editor: 100,
} as const;

function readAllLayouts(): Record<string, Layout> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, Layout>)
      : {};
  } catch {
    return {};
  }
}

export function readPanelLayout(groupId: string): Layout | undefined {
  return readAllLayouts()[groupId];
}

export function savePanelLayout(groupId: string, layout: Layout) {
  try {
    const layouts = readAllLayouts();
    layouts[groupId] = layout;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    // ignore quota / private mode errors
  }
}

/** Panel `defaultSize` / `minSize` / `maxSize` 百分比字符串（0–100）。 */
export function panelPct(value: number): string {
  return String(value);
}

/** Panel 尺寸像素字符串。 */
export function panelPx(value: number): string {
  return `${value}px`;
}
