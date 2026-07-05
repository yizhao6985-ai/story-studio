import type { Monaco } from "@monaco-editor/react";

import type { ResolvedTheme } from "@/lib/theme";

const DARK_THEME_ID = "story-studio-dark";
const LIGHT_THEME_ID = "story-studio-light";

/** 与 index.css design token 对齐的 Monaco 主题 */
export function defineStoryStudioMonacoThemes(monaco: Monaco) {
  monaco.editor.defineTheme(DARK_THEME_ID, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8a8a8a", fontStyle: "italic" },
      { token: "string", foreground: "89d185" },
      { token: "number", foreground: "cca700" },
      { token: "keyword", foreground: "d4a0a8" },
      { token: "tag", foreground: "6cb6ff" },
      { token: "attribute.name", foreground: "6cb6ff" },
      { token: "type", foreground: "6cb6ff" },
      { token: "metatag", foreground: "8a8a8a" },
      { token: "heading", foreground: "e8e8e8", fontStyle: "bold" },
      { token: "emphasis", fontStyle: "italic" },
      { token: "strong", fontStyle: "bold" },
      { token: "delimiter", foreground: "8a8a8a" },
    ],
    colors: {
      focusBorder: "#ffffff2e",
      "editor.background": "#00000000",
      "editor.foreground": "#d4d4d4",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.selectionBackground": "#ffffff26",
      "editor.inactiveSelectionBackground": "#ffffff14",
      "editorCursor.foreground": "#e8e8e8",
      "editorLineNumber.foreground": "#8a8a8a",
      "editorLineNumber.activeForeground": "#d4d4d4",
      "editorGutter.background": "#00000000",
      "editorWidget.background": "#1f1f1f99",
      "editorWidget.border": "#ffffff14",
      "editorIndentGuide.background": "#ffffff0a",
      "editorIndentGuide.activeBackground": "#ffffff14",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#ffffff14",
      "scrollbarSlider.hoverBackground": "#ffffff24",
      "scrollbarSlider.activeBackground": "#ffffff2e",
      "minimap.background": "#00000000",
    },
  });

  monaco.editor.defineTheme(LIGHT_THEME_ID, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6e6e6e", fontStyle: "italic" },
      { token: "string", foreground: "107c10" },
      { token: "number", foreground: "bf8803" },
      { token: "keyword", foreground: "811f3f" },
      { token: "tag", foreground: "0451a5" },
      { token: "attribute.name", foreground: "0451a5" },
      { token: "type", foreground: "0451a5" },
      { token: "metatag", foreground: "6e6e6e" },
      { token: "heading", foreground: "1a1a1a", fontStyle: "bold" },
      { token: "emphasis", fontStyle: "italic" },
      { token: "strong", fontStyle: "bold" },
      { token: "delimiter", foreground: "6e6e6e" },
    ],
    colors: {
      focusBorder: "#0000002e",
      "editor.background": "#00000000",
      "editor.foreground": "#333333",
      "editor.lineHighlightBackground": "#00000006",
      "editor.selectionBackground": "#0000001a",
      "editor.inactiveSelectionBackground": "#0000000d",
      "editorCursor.foreground": "#1a1a1a",
      "editorLineNumber.foreground": "#6e6e6e",
      "editorLineNumber.activeForeground": "#333333",
      "editorGutter.background": "#00000000",
      "editorWidget.background": "#f3f3f399",
      "editorWidget.border": "#00000014",
      "editorIndentGuide.background": "#0000000a",
      "editorIndentGuide.activeBackground": "#00000014",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#00000014",
      "scrollbarSlider.hoverBackground": "#00000024",
      "scrollbarSlider.activeBackground": "#0000002e",
      "minimap.background": "#00000000",
    },
  });
}

export function getMonacoThemeId(resolved: ResolvedTheme): string {
  return resolved === "dark" ? DARK_THEME_ID : LIGHT_THEME_ID;
}

export function getMonacoLanguage(path: string | null): string | undefined {
  if (!path) return undefined;
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  if (ext === ".md") return "markdown";
  if (ext === ".yaml" || ext === ".yml") return "yaml";
  if (ext === ".json") return "json";
  return "plaintext";
}
