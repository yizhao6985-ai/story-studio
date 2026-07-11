import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ComposerModeSelector,
  cycleComposerMode,
} from "@/features/composer-mode-selector";
import { WorkspaceSelector, type WorkspaceOption } from "@/features/workspace-selector";
import type { ComposerMode } from "@/hooks/types";
import { cn } from "@/lib/utils";

export type { WorkspaceOption };

type CreateConversationComposerProps = {
  workspaces: WorkspaceOption[];
  defaultWorkPath?: string;
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  onCreateWorkspace: () => void;
  onWorkspaceChange?: (workPath: string) => void;
  onCreate: (workPath: string, initialMessage: string) => Promise<void>;
  onCancel: () => void;
  className?: string;
};

export function CreateConversationComposer({
  workspaces,
  defaultWorkPath,
  mode,
  onModeChange,
  onCreateWorkspace,
  onWorkspaceChange,
  onCreate,
  onCancel,
  className,
}: CreateConversationComposerProps) {
  const [workPath, setWorkPath] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const workspacePathsKey = workspaces.map((item) => item.workPath).join("\0");

  useEffect(() => {
    setInitialMessage("");
    setError("");
  }, [defaultWorkPath]);

  useEffect(() => {
    setWorkPath((current) => {
      if (defaultWorkPath && workspaces.some((item) => item.workPath === defaultWorkPath)) {
        return defaultWorkPath;
      }
      if (current && workspaces.some((item) => item.workPath === current)) {
        return current;
      }
      if (workspaces.length === 1) {
        return workspaces[0]!.workPath;
      }
      return "";
    });
  }, [defaultWorkPath, workspacePathsKey]);

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!workPath) return;
    onWorkspaceChange?.(workPath);
  }, [workPath, onWorkspaceChange]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const canCreate = workspaces.some((item) => item.workPath === workPath);
  const placeholder = !canCreate
    ? "请先选择或创建工作空间"
    : "对 Story Studio 说点什么，开始这段对话…";

  const handleSubmit = async () => {
    if (!canCreate) {
      setError("请选择工作空间");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onCreate(workPath, initialMessage.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden px-6 py-8",
        className,
      )}
    >
      <div className="w-full max-w-[800px] space-y-4">
        <div className="text-center">
          <h3 className="mb-2 text-[15px] font-medium text-foreground">开始一段新对话</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            选择或创建工作空间，告诉 Story Studio你想写什么。
          </p>
        </div>

        {error && (
          <div className="rounded-none border border-destructive/20 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <WorkspaceSelector
          value={workPath}
          workspaces={workspaces}
          onValueChange={setWorkPath}
          onCreateWorkspace={onCreateWorkspace}
          disabled={loading}
        />

        <div className="w-full space-y-2">
          <div className="group w-full rounded-none border border-border bg-card transition-[border-color] duration-150 focus-within:border-foreground/20">
            <div className="flex items-end gap-1.5 px-2 py-1.5">
              <textarea
                ref={inputRef}
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder={placeholder}
                rows={3}
                disabled={loading}
                className="block min-h-[72px] flex-1 resize-none border-none bg-transparent px-1.5 py-1.5 text-[13px] leading-[1.7] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === "Tab" && e.shiftKey) {
                    e.preventDefault();
                    if (!loading) cycleComposerMode(mode, onModeChange);
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
              <Button
                variant="primary"
                size="icon"
                className="size-7 shrink-0 rounded-none"
                onClick={() => void handleSubmit()}
                disabled={loading || !canCreate}
                aria-label={loading ? "创建中" : "开始对话"}
                title={loading ? "创建中" : "开始对话 (Enter)"}
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <ArrowUp className="size-3.5" strokeWidth={2} />
                )}
              </Button>
            </div>
          </div>

          <ComposerModeSelector
            mode={mode}
            onModeChange={onModeChange}
            disabled={loading}
          />
        </div>
      </div>
    </section>
  );
}
