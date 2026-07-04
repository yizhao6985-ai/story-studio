import { FolderOpen, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CreateWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workPath: string) => void;
};

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const [title, setTitle] = useState("");
  const [directoryPath, setDirectoryPath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDirectoryPath("");
    setError("");
    setLoading(false);
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
  }, [open]);

  const handlePickDirectory = async () => {
    const picked = await window.storyStudio.library.pickDirectory();
    if (picked) setDirectoryPath(picked);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("请输入工作空间名称");
      return;
    }
    if (!directoryPath) {
      setError("请选择工作目录");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const snap = await window.storyStudio.library.createWorkspace(
        directoryPath,
        title.trim(),
      );
      onCreated(snap.workPath);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建工作空间失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <DialogHeader className="space-y-0">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-border bg-foreground/[0.04]">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 space-y-1 pt-0.5">
                <DialogTitle>创建工作空间</DialogTitle>
                <DialogDescription>
                  指定名称并选择文件夹。目录初始为空，开始写作后由 Agent 按需创建文件。
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-title">工作空间名称</Label>
            <Input
              ref={titleInputRef}
              id="workspace-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给这个工作空间起个名字"
              disabled={loading}
              className="h-9 bg-card"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit();
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>工作目录</Label>
            <button
              type="button"
              onClick={() => void handlePickDirectory()}
              disabled={loading}
              className={cn(
                "group flex w-full flex-col items-start gap-2 rounded-none border px-3.5 py-3 text-left transition-colors duration-100",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                directoryPath
                  ? "border-border bg-card hover:bg-foreground/[0.03]"
                  : "border-dashed border-border/80 bg-foreground/[0.02] hover:border-foreground/15 hover:bg-foreground/[0.04]",
              )}
            >
              <span className="flex items-center gap-2 text-[13px] text-foreground">
                <FolderOpen
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    directoryPath
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {directoryPath ? "更换文件夹" : "选择文件夹"}
              </span>
              {directoryPath ? (
                <span
                  className="w-full truncate font-mono text-[11px] leading-relaxed text-muted-foreground"
                  title={directoryPath}
                >
                  {directoryPath}
                </span>
              ) : (
                <span className="text-[11px] leading-relaxed text-muted-foreground">
                  点击浏览本地目录，作品文件将保存在此处
                </span>
              )}
            </button>
          </div>

          {error ? (
            <div className="rounded-none border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border bg-foreground/[0.02] px-5 py-3">
          <div className="flex w-full gap-2 sm:w-auto sm:ml-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  创建中…
                </>
              ) : (
                "创建工作空间"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
