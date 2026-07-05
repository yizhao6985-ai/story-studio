import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronsLeft,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { SIDEBAR_TARGET_PX } from "@/lib/panel-layout";

export const APP_SIDEBAR_WIDTH = SIDEBAR_TARGET_PX;

const appChromeIconButtonClass =
  "app-region-no-drag inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground";

const panelHeaderIconButtonClass = appChromeIconButtonClass;

type AppChromeProps = {
  trailing?: ReactNode;
  className?: string;
};

export function PanelHeaderBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="app-region-no-drag inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
      onClick={onClick}
      aria-label="返回"
      title="返回"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

export function PanelHeaderIconButton({
  children,
  onClick,
  "aria-label": ariaLabel,
  title,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  "aria-label": string;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(panelHeaderIconButtonClass, className)}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  );
}

export function FileTreePanelToggle({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = collapsed ? ListTree : ChevronsLeft;

  return (
    <button
      type="button"
      className={panelHeaderIconButtonClass}
      onClick={onClick}
      aria-label={collapsed ? "显示文件树" : "隐藏文件树"}
      title={collapsed ? "显示文件树" : "隐藏文件树"}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

/** 工作区文件树 + 编辑器共用顶栏 */
export function WorkspaceFilesHeader({
  fileTreeCollapsed,
  onToggleFileTree,
}: {
  fileTreeCollapsed: boolean;
  onToggleFileTree: () => void;
}) {
  return (
    <header className="flex h-[var(--app-chrome-height)] shrink-0 items-center border-b border-border">
      <FileTreePanelToggle collapsed={fileTreeCollapsed} onClick={onToggleFileTree} />
    </header>
  );
}

export function WorkspacePanelToggle({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;

  return (
    <button
      type="button"
      className={panelHeaderIconButtonClass}
      onClick={onClick}
      aria-label={collapsed ? "显示文件区" : "隐藏文件区"}
      title={collapsed ? "显示文件区" : "隐藏文件区"}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

export function ContentLayoutToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={panelHeaderIconButtonClass}
      onClick={onClick}
      aria-label="互换对话区与编辑区"
      title="互换对话区与编辑区"
    >
      <ArrowLeftRight className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

export function SidebarPanelToggle({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      type="button"
      className={appChromeIconButtonClass}
      onClick={onClick}
      aria-label={collapsed ? "显示侧边栏" : "隐藏侧边栏"}
      title={collapsed ? "显示侧边栏" : "隐藏侧边栏"}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

/** 侧栏顶栏（拖拽区），与对话区、文件区顶栏分离 */
export function AppSidebarChrome({
  className,
  onToggleSidebar,
  leadingControls,
}: {
  className?: string;
  onToggleSidebar?: () => void;
  leadingControls?: ReactNode;
}) {
  const showControls = onToggleSidebar || leadingControls;

  return (
    <header
      className={cn(
        "app-region-drag surface-sidebar flex h-[var(--app-chrome-height)] shrink-0 items-center border-b border-r border-border mac-traffic-light-pad",
        className,
      )}
    >
      {showControls ? (
        <div className="app-region-no-drag flex shrink-0 items-center">
          {onToggleSidebar ? (
            <SidebarPanelToggle collapsed={false} onClick={onToggleSidebar} />
          ) : null}
          {leadingControls}
        </div>
      ) : null}
    </header>
  );
}

/** 主内容区共用顶栏（对话 + 文件），仅展示上下文信息或操作 */
export function AppPanelHeader({
  children,
  trailing,
  className,
  inset = "default",
  sidebarCollapsed,
  onToggleSidebar,
  leadingControls,
}: {
  children?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  inset?: "default" | "flush";
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  leadingControls?: ReactNode;
}) {
  const showLeading = sidebarCollapsed && (onToggleSidebar || leadingControls);

  return (
    <header
      className={cn(
        "app-region-drag surface-glass-header flex h-[var(--app-chrome-height)] shrink-0 items-center gap-2 border-b border-border pr-4",
        className,
      )}
    >
      {showLeading ? (
        <div className="app-region-no-drag flex shrink-0 items-center mac-traffic-light-pad">
          {onToggleSidebar ? (
            <SidebarPanelToggle collapsed onClick={onToggleSidebar} />
          ) : null}
          {leadingControls}
        </div>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 items-center overflow-hidden",
          inset === "flush" ? "shrink-0" : "min-w-0 flex-1",
          !showLeading && (inset === "flush" ? "pl-0" : "pl-4"),
        )}
      >
        {children}
      </div>
      {trailing ? (
        <div className="app-region-no-drag ml-auto flex shrink-0 items-center gap-0.5">
          {trailing}
        </div>
      ) : null}
    </header>
  );
}

/** 全宽顶栏：用于初始配置、加载等无分栏布局 */
export function AppChrome({ trailing, className }: AppChromeProps) {
  return (
    <header
      className={cn(
        "app-region-drag surface-glass-header mac-traffic-light-pad flex h-[var(--app-chrome-height)] shrink-0 items-center border-b border-border pl-3 pr-4",
        className,
      )}
    >
      <div className="ml-auto flex min-w-0 items-center gap-3">{trailing}</div>
    </header>
  );
}
