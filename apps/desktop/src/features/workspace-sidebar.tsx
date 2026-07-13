import { useRef, useState } from "react";
import type { ConversationManifest } from "@/lib/story";
import { ChevronDown, ChevronRight, Folder, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOverlayDismiss } from "@/hooks/lib/use-overlay-dismiss";
import { cn } from "@/lib/utils";

export type WorkspaceSidebarEntry = {
  workPath: string;
  title: string;
  conversations: ConversationManifest[];
};

type WorkspaceContextMenuState = {
  x: number;
  y: number;
  workPath: string;
  title: string;
};

type WorkspaceSidebarProps = {
  workspaces: WorkspaceSidebarEntry[];
  activeWorkPath: string | null;
  activeConversationId: string | null;
  expandedWorkPaths: Set<string>;
  onNewConversation: () => void;
  onNewConversationInWorkspace: (workPath: string) => void;
  onOpenWorkspace: () => void;
  onRemoveWorkspace: (workPath: string) => void;
  onToggleWorkspace: (workPath: string) => void;
  onSelectConversation: (workPath: string, conversationId: string) => void;
  onDeleteConversation: (workPath: string, conversationId: string) => void;
};

export function WorkspaceSidebar({
  workspaces,
  activeWorkPath,
  activeConversationId,
  expandedWorkPaths,
  onNewConversation,
  onNewConversationInWorkspace,
  onOpenWorkspace,
  onRemoveWorkspace,
  onToggleWorkspace,
  onSelectConversation,
  onDeleteConversation,
}: WorkspaceSidebarProps) {
  const [contextMenu, setContextMenu] = useState<WorkspaceContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useOverlayDismiss(Boolean(contextMenu), menuRef, () => setContextMenu(null));

  const openContextMenu = (
    event: React.MouseEvent,
    workspace: WorkspaceSidebarEntry,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      workPath: workspace.workPath,
      title: workspace.title,
    });
  };

  return (
    <aside className="surface-sidebar flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-border">
      <div className="shrink-0 px-3 pt-3 pb-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full text-foreground"
          onClick={onNewConversation}
        >
          <Plus className="h-3.5 w-3.5" />
          新建对话
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2">
        <div className="mb-1 flex shrink-0 items-center justify-between px-1 py-1.5">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
            工作空间
          </span>
          <button
            type="button"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            aria-label="创建工作空间"
            title="创建工作空间"
            onClick={onOpenWorkspace}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {workspaces.length === 0 ? (
            <p className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">
              点击 + 创建工作空间
            </p>
          ) : (
            workspaces.map((workspace) => {
              const isExpanded = expandedWorkPaths.has(workspace.workPath);
              const isWorkspaceActive = activeWorkPath === workspace.workPath;

              return (
                <div key={workspace.workPath} className="mb-0.5">
                  <div
                    className={cn(
                      "group/workspace flex items-center rounded-none transition-colors duration-100 hover:bg-foreground/[0.04]",
                      isWorkspaceActive && "bg-foreground/[0.03]",
                    )}
                    onContextMenu={(event) => openContextMenu(event, workspace)}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5 text-left"
                      onClick={() => onToggleWorkspace(workspace.workPath)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="hidden h-3 w-3 shrink-0 text-muted-foreground group-hover/workspace:block" />
                      ) : (
                        <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted-foreground group-hover/workspace:block" />
                      )}
                      <Folder className="h-3 w-3 shrink-0 text-muted-foreground group-hover/workspace:hidden" />
                      <span className="truncate text-xs font-medium text-foreground">
                        {workspace.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="mr-1 hidden h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors group-hover/workspace:flex hover:bg-foreground/[0.06] hover:text-foreground"
                      aria-label={`在 ${workspace.title} 中新建对话`}
                      title="新建对话"
                      onClick={(event) => {
                        event.stopPropagation();
                        onNewConversationInWorkspace(workspace.workPath);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-0.5 ml-3 border-l border-border pl-1">
                      {workspace.conversations.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">暂无对话</p>
                      ) : (
                        workspace.conversations.map((conversation) => {
                          const isActive =
                            isWorkspaceActive && activeConversationId === conversation.id;
                          return (
                            <div
                              key={conversation.id}
                              className={cn(
                                "group/conversation mb-px flex items-center rounded-none transition-colors duration-100 hover:bg-foreground/[0.04]",
                                isActive && "bg-foreground/[0.06]",
                              )}
                            >
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center px-2 py-1.5 text-left"
                                onClick={() =>
                                  onSelectConversation(workspace.workPath, conversation.id)
                                }
                              >
                                <span
                                  className={cn(
                                    "truncate text-xs leading-snug",
                                    isActive ? "text-foreground" : "text-muted-foreground",
                                  )}
                                >
                                  {conversation.title}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="mr-1 hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors group-hover/conversation:flex hover:bg-foreground/[0.06] hover:text-foreground"
                                aria-label={`删除对话「${conversation.title}」`}
                                title="删除对话"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDeleteConversation(workspace.workPath, conversation.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[168px] rounded-none border border-border bg-popover py-1 text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="flex w-full cursor-pointer px-3 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-foreground/[0.04]"
            onClick={() => {
              onRemoveWorkspace(contextMenu.workPath);
              setContextMenu(null);
            }}
          >
            移除工作空间
          </button>
        </div>
      )}
    </aside>
  );
}
