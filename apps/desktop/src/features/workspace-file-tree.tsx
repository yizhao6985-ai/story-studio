import { useEventListener, useLatest, useSize } from "ahooks";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WorkspaceEntry } from "@/lib/story";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
} from "lucide-react";
import { Tree, type NodeApi, type NodeRendererProps, type TreeApi } from "react-arborist";

import { isProtectedWorkspacePath } from "@/lib/story/protected-paths";
import { findWorkspaceEntry } from "@/lib/workspace-tree-utils";
import { useOverlayDismiss } from "@/hooks/lib/use-overlay-dismiss";
import { cn } from "@/lib/utils";
import { formatShortcut, matchesShortcut } from "@/lib/keyboard-shortcuts";

export type WorkspaceTreeNode = {
  id: string;
  name: string;
  children?: WorkspaceTreeNode[];
};

type WorkspaceFileTreeProps = {
  entries: WorkspaceEntry[];
  selectedPath: string | null;
  workPath: string;
  onSelectFile: (path: string) => void;
  onMutated: () => Promise<void>;
};

type TreeContextMenu =
  | { kind: "empty"; x: number; y: number }
  | {
      kind: "node";
      x: number;
      y: number;
      nodeId: string;
      isDir: boolean;
      isProtected: boolean;
    };

function clampContextMenuPosition(x: number, y: number, width: number, height: number) {
  const padding = 8;
  return {
    x: Math.min(Math.max(padding, x), window.innerWidth - width - padding),
    y: Math.min(Math.max(padding, y), window.innerHeight - height - padding),
  };
}

function entriesToTreeData(entries: WorkspaceEntry[]): WorkspaceTreeNode[] {
  return entries.map((entry) => {
    if (entry.kind === "directory") {
      return {
        id: entry.path,
        name: entry.name,
        children: entry.children?.length ? entriesToTreeData(entry.children) : [],
      };
    }
    return { id: entry.path, name: entry.name };
  });
}

function collectSiblingNames(entries: WorkspaceEntry[], parentPath: string | null): Set<string> {
  const siblings =
    parentPath === null
      ? entries
      : (findWorkspaceEntry(entries, parentPath)?.children ?? []);
  return new Set(siblings.map((entry) => entry.name));
}

function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let index = 2;
  while (taken.has(`${stem} ${index}${ext}`)) index += 1;
  return `${stem} ${index}${ext}`;
}

function joinPath(parentPath: string | null, name: string): string {
  return parentPath ? `${parentPath}/${name}` : name;
}

function parentPathOf(nodeId: string): string | null {
  const slash = nodeId.lastIndexOf("/");
  return slash >= 0 ? nodeId.slice(0, slash) : null;
}

function workspaceErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "PROTECTED_FILE") return "该文件是作品元数据，无法删除";
  if (code === "PROTECTED_RENAME") return "该文件是作品元数据，无法重命名";
  if (code === "FILE_NOT_WRITABLE") return "此类型文件不支持编辑或重命名";
  if (code === "DIRECTORY_NAME_NOT_ASCII") {
    return "文件夹名须使用英文（如 new-folder、chapters）";
  }
  return "操作失败，请重试";
}

function WorkspaceFileIcon({ name }: { name: string }) {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
  const className = "h-3.5 w-3.5 shrink-0 text-muted-foreground";

  switch (ext) {
    case ".md":
    case ".markdown":
      return <FileText className={className} />;
    case ".json":
      return <FileJson className={className} />;
    case ".ts":
    case ".tsx":
    case ".js":
    case ".jsx":
      return <FileCode className={className} />;
    default:
      return <File className={className} />;
  }
}

function EditInput({ node }: { node: NodeApi<WorkspaceTreeNode> }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      defaultValue={node.data.name}
      className="min-w-0 flex-1 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground outline-none"
      onClick={(event) => event.stopPropagation()}
      onBlur={() => node.reset()}
      onKeyDown={(event) => {
        if (event.key === "Escape") node.reset();
        if (event.key === "Enter") node.submit(inputRef.current?.value ?? "");
      }}
    />
  );
}

function TreeNode({
  node,
  style,
  dragHandle,
  onNodeContextMenu,
}: NodeRendererProps<WorkspaceTreeNode> & {
  onNodeContextMenu: (event: React.MouseEvent, node: NodeApi<WorkspaceTreeNode>) => void;
}) {
  const isDir = node.isInternal;

  const handleRowClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isDir) {
      node.select();
      node.toggle();
      return;
    }
    node.handleClick(event);
  };

  return (
    <div
      style={style}
      ref={dragHandle}
      className={cn(
        "flex items-center rounded-none pr-1 text-xs transition-colors duration-100",
        node.isSelected ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        node.isEditing && "bg-foreground/[0.04]",
        node.willReceiveDrop && "bg-foreground/[0.08]",
      )}
      onClick={handleRowClick}
      onContextMenu={(event) => onNodeContextMenu(event, node)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate py-1 pl-1">
        {isDir ? (
          node.isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <WorkspaceFileIcon name={node.data.name} />
        )}
        {node.isEditing ? (
          <EditInput node={node} />
        ) : (
          <span className="truncate">{node.data.name}</span>
        )}
      </span>
    </div>
  );
}

function ContextMenuItem({
  label,
  destructive = false,
  disabled = false,
  onClick,
}: {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full cursor-pointer px-3 py-1.5 text-left text-xs transition-colors hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-40",
        destructive ? "text-destructive" : "text-popover-foreground",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ContextMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

export function WorkspaceFileTree({
  entries,
  selectedPath,
  workPath,
  onSelectFile,
  onMutated,
}: WorkspaceFileTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<TreeApi<WorkspaceTreeNode>>(null);
  const containerSize = useSize(containerRef);
  const height = Math.max(120, containerSize?.height ?? 240);
  const [treeError, setTreeError] = useState("");
  const [contextMenu, setContextMenu] = useState<TreeContextMenu | null>(null);
  const [menuCoords, setMenuCoords] = useState({ x: 0, y: 0 });

  const treeData = useMemo(() => entriesToTreeData(entries), [entries]);

  useEffect(() => {
    if (!selectedPath || !treeRef.current) return;
    treeRef.current.select(selectedPath);
    treeRef.current.openParents(selectedPath);
  }, [selectedPath, treeData]);

  useOverlayDismiss(Boolean(contextMenu), menuRef, () => setContextMenu(null));

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    setMenuCoords(clampContextMenuPosition(contextMenu.x, contextMenu.y, rect.width, rect.height));
  }, [contextMenu]);

  const createEntry = useCallback(
    async (parentId: string | null, type: "internal" | "leaf") => {
      const siblings = collectSiblingNames(entries, parentId);
      const baseName = type === "internal" ? "new-folder" : "untitled.md";
      const name = uniqueName(baseName, siblings);
      const relativePath = joinPath(parentId, name);

      if (type === "internal") {
        await window.storyStudio.library.createWorkspaceDirectory(workPath, relativePath);
      } else {
        await window.storyStudio.library.createWorkspaceFile(workPath, relativePath, "");
      }

      await onMutated();
      if (type === "leaf") onSelectFile(relativePath);
      return type === "internal"
        ? { id: relativePath, name, children: [] as WorkspaceTreeNode[] }
        : { id: relativePath, name };
    },
    [entries, onMutated, onSelectFile, workPath],
  );

  const deleteEntries = useCallback(
    async (ids: string[]) => {
      setTreeError("");
      for (const id of ids) {
        if (isProtectedWorkspacePath(id)) {
          setTreeError("该文件是作品元数据，无法删除");
          return;
        }
        try {
          await window.storyStudio.library.deleteWorkspaceEntry(workPath, id);
        } catch (error) {
          setTreeError(workspaceErrorMessage(error));
          return;
        }
      }
      await onMutated();
    },
    [onMutated, workPath],
  );

  const deleteEntriesRef = useLatest(deleteEntries);

  useEventListener("keydown", (event) => {
    const container = containerRef.current;
    if (!container?.contains(document.activeElement)) return;
    if (treeRef.current?.isEditing) return;

    const isDeleteShortcut =
      matchesShortcut(event, ["mod", "Backspace"]) ||
      matchesShortcut(event, ["mod", "Delete"]);
    if (!isDeleteShortcut) return;

    event.preventDefault();

    const tree = treeRef.current;
    if (!tree) return;

    const ids =
      tree.selectedIds.size > 0
        ? Array.from(tree.selectedIds)
        : tree.focusedNode
          ? [tree.focusedNode.id]
          : [];
    if (ids.length === 0) return;

    void deleteEntriesRef.current(ids);
  });

  const resolveCreateParentId = useCallback((): string | null => {
    const tree = treeRef.current;
    if (!tree) return null;
    const focus = tree.focusedNode;
    if (focus?.isInternal) return focus.id;
    if (focus) return parentPathOf(focus.id);
    return null;
  }, []);

  const createInParent = useCallback(
    (parentId: string | null, type: "internal" | "leaf") => {
      setContextMenu(null);
      if (treeData.length === 0) {
        void createEntry(null, type);
        return;
      }
      const tree = treeRef.current;
      if (!tree) return;
      if (parentId) {
        const parent = tree.get(parentId);
        if (parent?.isInternal && !parent.isOpen) parent.open();
        void tree.create({ type, parentId, index: 0 });
        return;
      }
      if (type === "internal") void tree.createInternal();
      else void tree.createLeaf();
    },
    [createEntry, treeData.length],
  );

  const handleEmptyCreate = useCallback(
    (type: "internal" | "leaf") => {
      setContextMenu(null);
      if (treeData.length === 0) {
        void createEntry(null, type);
        return;
      }
      void treeRef.current?.create({ type, parentId: null, index: 0 });
    },
    [createEntry, treeData.length],
  );

  const handleCreateFromMenu = useCallback(
    (type: "internal" | "leaf", parentId?: string | null) => {
      const targetParent = parentId !== undefined ? parentId : resolveCreateParentId();
      createInParent(targetParent, type);
    },
    [createInParent, resolveCreateParentId],
  );

  const handleRenameFromMenu = useCallback((nodeId: string) => {
    setContextMenu(null);
    treeRef.current?.select(nodeId);
    treeRef.current?.get(nodeId)?.edit();
  }, []);

  const handleDeleteFromMenu = useCallback(
    (nodeId: string) => {
      setContextMenu(null);
      void deleteEntries([nodeId]);
    },
    [deleteEntries],
  );

  const openEmptyContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuCoords({ x: event.clientX, y: event.clientY });
    setContextMenu({ kind: "empty", x: event.clientX, y: event.clientY });
  };

  const openNodeContextMenu = (
    event: React.MouseEvent,
    node: NodeApi<WorkspaceTreeNode>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    node.select();
    setMenuCoords({ x: event.clientX, y: event.clientY });
    setContextMenu({
      kind: "node",
      x: event.clientX,
      y: event.clientY,
      nodeId: node.data.id,
      isDir: node.isInternal,
      isProtected: isProtectedWorkspacePath(node.data.id),
    });
  };

  const createParentForNode = (menu: Extract<TreeContextMenu, { kind: "node" }>) =>
    menu.isDir ? menu.nodeId : parentPathOf(menu.nodeId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {treeError ? (
        <p className="shrink-0 border-b border-border px-2 py-1.5 text-[11px] text-destructive">
          {treeError}
        </p>
      ) : null}

      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-hidden px-[5px] py-1"
        onContextMenu={openEmptyContextMenu}
      >
        {treeData.length === 0 ? (
          <p className="px-2 py-3 text-[13px] text-muted-foreground">工作区暂无文件</p>
        ) : (
          <Tree
            ref={treeRef}
            data={treeData}
            width="100%"
            height={height}
            indent={14}
            rowHeight={28}
            openByDefault={false}
            selection={selectedPath ?? undefined}
            onActivate={(node) => {
              if (node.isInternal) return;
              onSelectFile(node.data.id);
            }}
            onSelect={(nodes) => {
              const node = nodes[0];
              if (node && !node.isInternal) onSelectFile(node.data.id);
            }}
            onCreate={({ parentId, type }) => createEntry(parentId, type)}
            onRename={async ({ id, name, node }) => {
              const parent = id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : "";
              const nextPath = joinPath(parent || null, name);
              if (nextPath === id) return;
              if (isProtectedWorkspacePath(id)) {
                setTreeError("该文件是作品元数据，无法重命名");
                return;
              }
              setTreeError("");
              try {
                await window.storyStudio.library.renameWorkspaceEntry(workPath, id, nextPath);
                if (!node.isInternal && selectedPath === id) onSelectFile(nextPath);
                await onMutated();
              } catch (error) {
                setTreeError(workspaceErrorMessage(error));
              }
            }}
            onMove={async ({ dragIds, parentId }) => {
              setTreeError("");
              for (const id of dragIds) {
                if (isProtectedWorkspacePath(id)) {
                  setTreeError("该文件是作品元数据，无法移动");
                  return;
                }
                const name = id.split("/").pop() ?? id;
                const nextPath = joinPath(parentId, name);
                if (nextPath === id) continue;
                try {
                  await window.storyStudio.library.renameWorkspaceEntry(workPath, id, nextPath);
                  if (selectedPath === id) onSelectFile(nextPath);
                } catch (error) {
                  setTreeError(workspaceErrorMessage(error));
                  return;
                }
              }
              await onMutated();
            }}
          >
            {(props) => (
              <TreeNode {...props} onNodeContextMenu={openNodeContextMenu} />
            )}
          </Tree>
        )}
      </div>

      {contextMenu
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 min-w-[168px] rounded-none border border-border bg-popover py-1 text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
              style={{ left: menuCoords.x, top: menuCoords.y }}
              onContextMenu={(event) => event.preventDefault()}
            >
              {contextMenu.kind === "empty" ? (
                <>
                  <ContextMenuItem
                    label="新建文件"
                    onClick={() => handleEmptyCreate("leaf")}
                  />
                  <ContextMenuItem
                    label="新建文件夹"
                    onClick={() => handleEmptyCreate("internal")}
                  />
                </>
              ) : (
                <>
                  <ContextMenuItem
                    label="新建文件"
                    onClick={() =>
                      handleCreateFromMenu("leaf", createParentForNode(contextMenu))
                    }
                  />
                  <ContextMenuItem
                    label="新建文件夹"
                    onClick={() =>
                      handleCreateFromMenu("internal", createParentForNode(contextMenu))
                    }
                  />
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    label="重命名"
                    disabled={contextMenu.isProtected}
                    onClick={() => handleRenameFromMenu(contextMenu.nodeId)}
                  />
                  <ContextMenuItem
                    label={`删除 (${formatShortcut(["mod", "Backspace"])})`}
                    destructive
                    disabled={contextMenu.isProtected}
                    onClick={() => handleDeleteFromMenu(contextMenu.nodeId)}
                  />
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
