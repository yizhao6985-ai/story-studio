export type EditorRenderWhitespace = "none" | "boundary" | "selection" | "all";

export type EditorSettings = {
  fontSize: number;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  renderWhitespace: EditorRenderWhitespace;
  smoothScrolling: boolean;
  scrollBeyondLastLine: boolean;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 12,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: false,
  lineNumbers: true,
  minimap: false,
  renderWhitespace: "none",
  smoothScrolling: true,
  scrollBeyondLastLine: false,
};

export const EDITOR_FONT_SIZE_OPTIONS = [11, 12, 13, 14, 15, 16, 18] as const;
export const EDITOR_TAB_SIZE_OPTIONS = [2, 4, 8] as const;

const STORAGE_KEY = "storyStudio.editorSettings";

function isRenderWhitespace(value: unknown): value is EditorRenderWhitespace {
  return value === "none" || value === "boundary" || value === "selection" || value === "all";
}

function normalizeEditorSettings(value: unknown): EditorSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_EDITOR_SETTINGS };
  }

  const raw = value as Partial<EditorSettings>;
  const fontSize =
    typeof raw.fontSize === "number" &&
    EDITOR_FONT_SIZE_OPTIONS.includes(raw.fontSize as (typeof EDITOR_FONT_SIZE_OPTIONS)[number])
      ? raw.fontSize
      : DEFAULT_EDITOR_SETTINGS.fontSize;
  const tabSize =
    typeof raw.tabSize === "number" &&
    EDITOR_TAB_SIZE_OPTIONS.includes(raw.tabSize as (typeof EDITOR_TAB_SIZE_OPTIONS)[number])
      ? raw.tabSize
      : DEFAULT_EDITOR_SETTINGS.tabSize;

  return {
    fontSize,
    tabSize,
    insertSpaces:
      typeof raw.insertSpaces === "boolean"
        ? raw.insertSpaces
        : DEFAULT_EDITOR_SETTINGS.insertSpaces,
    wordWrap:
      typeof raw.wordWrap === "boolean" ? raw.wordWrap : DEFAULT_EDITOR_SETTINGS.wordWrap,
    lineNumbers:
      typeof raw.lineNumbers === "boolean"
        ? raw.lineNumbers
        : DEFAULT_EDITOR_SETTINGS.lineNumbers,
    minimap: typeof raw.minimap === "boolean" ? raw.minimap : DEFAULT_EDITOR_SETTINGS.minimap,
    renderWhitespace: isRenderWhitespace(raw.renderWhitespace)
      ? raw.renderWhitespace
      : DEFAULT_EDITOR_SETTINGS.renderWhitespace,
    smoothScrolling:
      typeof raw.smoothScrolling === "boolean"
        ? raw.smoothScrolling
        : DEFAULT_EDITOR_SETTINGS.smoothScrolling,
    scrollBeyondLastLine:
      typeof raw.scrollBeyondLastLine === "boolean"
        ? raw.scrollBeyondLastLine
        : DEFAULT_EDITOR_SETTINGS.scrollBeyondLastLine,
  };
}

export function readStoredEditorSettings(): EditorSettings {
  try {
    const raw =
      typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_EDITOR_SETTINGS };
    return normalizeEditorSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_EDITOR_SETTINGS };
  }
}

export function writeStoredEditorSettings(settings: EditorSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function editorLineHeight(fontSize: number): number {
  return Math.round(fontSize * (22 / 13));
}
