import { useState } from "react";
import { FolderOpen, Plus } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type WorkspaceOption = {
  workPath: string;
  title: string;
};

type WorkspaceSelectorProps = {
  value: string;
  workspaces: WorkspaceOption[];
  onValueChange: (value: string) => void;
  onCreateWorkspace: () => void;
  disabled?: boolean;
  className?: string;
};

function workspaceLabel(
  value: string,
  workspaces: WorkspaceOption[],
): string {
  return workspaces.find((item) => item.workPath === value)?.title ?? "选择工作空间";
}

export function WorkspaceSelector({
  value,
  workspaces,
  onValueChange,
  onCreateWorkspace,
  disabled = false,
  className,
}: WorkspaceSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={value || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "h-8 w-auto max-w-[240px] gap-1.5 border-border bg-foreground/[0.02] text-xs",
          className,
        )}
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="选择工作空间">
          {value ? workspaceLabel(value, workspaces) : "选择工作空间"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        footer={
          <button
            type="button"
            className="flex w-full cursor-default select-none items-center gap-1.5 rounded-none px-2 py-1.5 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground"
            onClick={() => {
              setOpen(false);
              onCreateWorkspace();
            }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            创建新工作空间
          </button>
        }
      >
        {workspaces.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">暂无工作空间</p>
        ) : (
          workspaces.map((workspace) => (
            <SelectItem key={workspace.workPath} value={workspace.workPath} className="text-xs">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                {workspace.title}
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
