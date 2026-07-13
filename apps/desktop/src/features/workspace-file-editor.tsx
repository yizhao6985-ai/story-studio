import { useEventListener } from "ahooks";
import Editor from "@monaco-editor/react";
import { Loader2, X } from "lucide-react";
import { useMemo } from "react";

import {
  defineStoryStudioMonacoThemes,
  getMonacoLanguage,
  getMonacoThemeId,
} from "@/features/workspace-monaco-theme";
import { useEditorSettings } from "@/hooks/settings/use-editor-settings";
import { editorLineHeight } from "@/lib/editor-settings";
import { computeTextStats, formatTextStats } from "@/lib/text-stats";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { cn } from "@/lib/utils";

export type WorkspaceFileTab = {
  path: string;
  dirty: boolean;
};

type WorkspaceFileEditorProps = {
  openTabs: WorkspaceFileTab[];
  path: string | null;
  value: string;
  savedValue: string;
  loading: boolean;
  saving: boolean;
  readable: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
};

function tabLabel(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

export function WorkspaceFileEditor({
  openTabs,
  path,
  value,
  savedValue,
  loading,
  saving,
  readable,
  onChange,
  onSave,
  onSelectTab,
  onCloseTab,
}: WorkspaceFileEditorProps) {
  const dirty = value !== savedValue;
  const resolvedTheme = useResolvedTheme();
  const monacoTheme = getMonacoThemeId(resolvedTheme);
  const { settings: editorSettings } = useEditorSettings();
  const textStats = useMemo(() => computeTextStats(value), [value]);
  const showStatusBar = Boolean(path && readable && !loading);

  useEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault();
      if (dirty && readable && path && !saving) onSave();
    }
  });

  if (openTabs.length === 0 && !path) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs leading-relaxed text-muted-foreground">
        从左侧选择文件，在这里查看和编辑工作区内容。
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {openTabs.length > 0 ? (
        <div className="flex shrink-0 overflow-x-auto border-b border-border">
          {openTabs.map((tab) => {
            const isActive = path === tab.path;
            const label = tabLabel(tab.path);
            return (
              <div
                key={tab.path}
                className={cn(
                  "group/tab flex shrink-0 items-center border-r border-border transition-colors",
                  isActive ? "bg-card" : "bg-foreground/[0.02] hover:bg-foreground/[0.04]",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "flex max-w-[168px] items-center px-2.5 py-1.5 text-left",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                  title={tab.path}
                  onClick={() => onSelectTab(tab.path)}
                >
                  <span className="truncate font-mono text-[11px]">{label}</span>
                </button>
                <div className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center">
                  {tab.dirty ? (
                    <span
                      className="h-1.5 w-1.5 rounded-none bg-warning"
                      title="未保存"
                      aria-label="未保存"
                    />
                  ) : (
                    <button
                      type="button"
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground",
                        isActive ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100",
                      )}
                      aria-label={`关闭「${label}」`}
                      title="关闭"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCloseTab(tab.path);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!path ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-xs leading-relaxed text-muted-foreground">
          从左侧选择文件，在这里查看和编辑工作区内容。
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          加载中…
        </div>
      ) : !readable ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
          「{path}」无法在编辑器中打开。
        </div>
      ) : (
        <div
          className={cn(
            "surface-sidebar min-h-0 flex-1 overflow-hidden",
            "[&_.monaco-editor]:outline-none",
            "[&_.monaco-scrollable-element>.scrollbar]:w-2!",
            "[&_.monaco-scrollable-element>.scrollbar.horizontal]:h-2!",
          )}
        >
          <Editor
            key={`${path}-${monacoTheme}`}
            height="100%"
            theme={monacoTheme}
            language={getMonacoLanguage(path)}
            value={value}
            beforeMount={defineStoryStudioMonacoThemes}
            onChange={(nextValue) => onChange(nextValue ?? "")}
            options={{
              minimap: { enabled: editorSettings.minimap },
              fontSize: editorSettings.fontSize,
              lineHeight: editorLineHeight(editorSettings.fontSize),
              fontFamily: '"SF Mono", "JetBrains Mono", "Menlo", monospace',
              wordWrap: editorSettings.wordWrap ? "on" : "off",
              scrollBeyondLastLine: editorSettings.scrollBeyondLastLine,
              padding: { top: 10, bottom: 10 },
              renderLineHighlight: "gutter",
              smoothScrolling: editorSettings.smoothScrolling,
              tabSize: editorSettings.tabSize,
              insertSpaces: editorSettings.insertSpaces,
              lineNumbers: editorSettings.lineNumbers ? "on" : "off",
              renderWhitespace: editorSettings.renderWhitespace,
              automaticLayout: true,
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              glyphMargin: false,
              folding: false,
              lineNumbersMinChars: 3,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
                useShadows: false,
              },
              guides: {
                indentation: true,
                highlightActiveIndentation: false,
              },
            }}
          />
        </div>
      )}

      {showStatusBar ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 py-1.5">
          <span className="truncate font-mono text-[11px] text-muted-foreground" title={path ?? undefined}>
            {formatTextStats(textStats)}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {saving ? (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                保存中…
              </span>
            ) : dirty ? (
              <span className="text-[11px] text-warning">未保存</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
