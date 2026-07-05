export type ShortcutKeyToken = "mod" | "shift" | string;

export type KeyboardShortcut = {
  keys: ShortcutKeyToken[];
  label: string;
  scope: string;
};

export function isMacPlatform(): boolean {
  return window.storyStudio.platform === "darwin";
}

export function formatShortcutKey(token: ShortcutKeyToken): string {
  if (token === "mod") return isMacPlatform() ? "⌘" : "Ctrl";
  if (token === "shift") return isMacPlatform() ? "⇧" : "Shift";
  if (token === "Enter") return "Enter";
  if (token === "Tab") return "Tab";
  if (token === "Backspace") return isMacPlatform() ? "⌫" : "Backspace";
  if (token === ",") return ",";
  if (token === "/") return "/";
  return token.toUpperCase();
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { keys: ["Enter"], label: "发送消息", scope: "对话" },
  { keys: ["shift", "Enter"], label: "换行", scope: "对话" },
  { keys: ["shift", "Tab"], label: "切换模式", scope: "对话" },
  { keys: ["Enter"], label: "开始对话", scope: "新建对话" },
  { keys: ["mod", "S"], label: "保存当前文件", scope: "文件编辑" },
  { keys: ["mod", "Backspace"], label: "删除选中文件", scope: "文件树" },
  { keys: ["mod", "W"], label: "关闭当前文件 / 关闭窗口", scope: "全局" },
  { keys: ["mod", "B"], label: "显示 / 隐藏文件区", scope: "全局" },
  { keys: ["mod", ","], label: "打开设置", scope: "全局" },
  { keys: ["mod", "/"], label: "查看快捷键", scope: "全局" },
];

export function formatShortcut(keys: ShortcutKeyToken[]): string {
  return keys.map(formatShortcutKey).join(" + ");
}

export function matchesShortcut(
  event: KeyboardEvent,
  keys: ShortcutKeyToken[],
): boolean {
  const needsMod = keys.includes("mod");
  const needsShift = keys.includes("shift");
  const mainKey = keys.find((key) => key !== "mod" && key !== "shift");
  if (!mainKey) return false;

  const modPressed = event.metaKey || event.ctrlKey;
  if (needsMod !== modPressed) return false;
  if (needsShift !== event.shiftKey) return false;

  return event.key.toLowerCase() === mainKey.toLowerCase();
}
