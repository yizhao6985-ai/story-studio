import { useEffect } from "react";
import { Keyboard, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useAppShellState } from "@/hooks/app/use-app-shell-state";
import { useContentLayoutSwap } from "@/hooks/layout/use-content-layout-swap";
import { useSidebarWidthSync } from "@/hooks/layout/use-sidebar-width-sync";
import {
  AppPanelHeader,
  AppSidebarChrome,
  ContentLayoutToggle,
  PanelHeaderBackButton,
  PanelHeaderIconButton,
  WorkspacePanelToggle,
} from "@/features/app-chrome";
import { CreateConversationComposer } from "@/features/create-conversation-composer";
import { ConversationComposer } from "@/features/conversation-composer";
import { LlmErrorAlert } from "@/features/llm-error-alert";
import { AssistantTurnBubble } from "@/features/assistant-turn-bubble";
import { CreateWorkspaceDialog } from "@/features/create-workspace-dialog";
import { KeyboardShortcutsDialog } from "@/features/keyboard-shortcuts-dialog";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { WorkspaceSidebar } from "@/features/workspace-sidebar";
import { WorkWorkspacePanel } from "@/features/work-workspace-panel";
import {
  DEFAULT_APP_CONTENT_LAYOUT,
  DEFAULT_APP_SHELL_LAYOUT,
  PANEL_LAYOUT_IDS,
  PANEL_MAX_PX,
  PANEL_MIN_PX,
  panelPct,
  panelPx,
  readPanelLayout,
  savePanelLayout,
} from "@/lib/panel-layout";
import { formatShortcut } from "@/lib/keyboard-shortcuts";
import { cn } from "@/lib/utils";

const CONVERSATION_CONTENT_CLASS = "mx-auto w-full max-w-[800px] px-6";

export function AppShell() {
  const state = useAppShellState();
  useSidebarWidthSync(state.sidebarMeasureRef);
  const { contentLayoutSwapped, toggleContentLayout } = useContentLayoutSwap();

  const {
    sidebarMeasureRef,
    messagesEndRef,
    sidebarWorkspaces,
    workspaceOptions,
    expandedWorkPaths,
    activeWorkspace,
    setActiveWorkspace,
    activeConversationId,
    mode,
    setMode,
    delegateMaxTurns,
    setDelegateMaxTurns,
    input,
    setInput,
    messages,
    loading,
    llmConfigured,
    showSettings,
    settingsSectionId,
    composeDefaultWorkPath,
    createWorkspaceOpen,
    setCreateWorkspaceOpen,
    llmError,
    appNotice,
    contextUsage,
    delegateSession,
    shortcutsOpen,
    setShortcutsOpen,
    conversationContextLabel,
    panel,
    sidebarPanel,
    openCreateWorkspaceDialog,
    handleWorkspaceCreated,
    closeComposeConversation,
    handleNewConversation,
    handleNewConversationInWorkspace,
    startNewConversation,
    toggleWorkspace,
    send,
    openSettings,
    openQuickSettings,
    closeSettings,
    selectConversation,
    deleteConversation,
    removeWorkspace,
    workspaceFilesRef,
  } = state;

  useEffect(() => {
    if (showSettings || !activeConversationId || !panel.workspacePanelCollapsed) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      panel.syncContentLayout();
    });
    return () => cancelAnimationFrame(frame);
  }, [
    showSettings,
    activeConversationId,
    panel.workspacePanelCollapsed,
    panel.syncContentLayout,
  ]);

  const conversationSection = (
    <section
      className={cn(
        "surface-sidebar flex h-full min-h-0 min-w-0 flex-col overflow-hidden",
        contentLayoutSwapped ? "border-l border-border" : "border-r border-border",
      )}
    >
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            CONVERSATION_CONTENT_CLASS,
            "flex min-h-full flex-col gap-4 pt-5 pb-4",
          )}
        >
          {messages.length === 0 && !loading && (
            <div className="flex flex-1 items-center justify-center py-12">
              <p className="max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
                告诉 Story Studio你想写什么，或者让它帮你完善「
                {activeWorkspace?.manifest.title ?? "当前作品"}」。
              </p>
            </div>
          )}
          {messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <div
                  key={i}
                  className="animate-fade-in max-w-[85%] self-end text-[13px] leading-[1.7] whitespace-pre-wrap"
                >
                  <div className="rounded-none bg-foreground/[0.06] px-3.5 py-2.5 text-foreground">
                    {m.text}
                  </div>
                </div>
              );
            }

            if (m.role === "delegate") {
              return (
                <div
                  key={i}
                  className="animate-fade-in max-w-[85%] self-end text-[13px] leading-[1.7] whitespace-pre-wrap"
                >
                  <div className="mb-1 text-[11px] text-delegate">代理 · 第 {m.turn} 轮</div>
                  <div className="rounded-none border border-delegate/20 bg-delegate/5 px-3.5 py-2.5 text-foreground">
                    {m.text}
                  </div>
                </div>
              );
            }

            if (m.role === "delegate_summary") {
              const statusLabel =
                m.status === "completed"
                  ? "托管完成"
                  : m.status === "paused"
                    ? "托管已暂停"
                    : m.status === "escalated"
                      ? "需要你的介入"
                      : m.status === "max_turns"
                        ? "已达轮数上限"
                        : "托管结束";
              return (
                <div
                  key={i}
                  className="animate-fade-in max-w-[90%] self-center text-[13px] leading-[1.7]"
                >
                  <div className="rounded-none border border-delegate/20 bg-delegate/5 px-3.5 py-2.5 text-foreground">
                    <div className="mb-1 text-xs font-medium text-delegate">{statusLabel}</div>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    {m.artifactPaths.length > 0 ? (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        产出：{m.artifactPaths.join("、")}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }

            return (
              <AssistantTurnBubble
                key={i}
                text={m.text}
                streaming={m.streaming}
                activityLog={m.activityLog}
                subtasks={m.subtasks}
                agentStatus={m.agentStatus}
                onOpenPath={(path) => workspaceFilesRef.current?.openFile(path)}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 pb-4 pt-2">
        <div
          className={cn("space-y-2", CONVERSATION_CONTENT_CLASS)}
        >
          {!llmConfigured && (
            <div className="rounded-none border border-warning/20 bg-warning/5 px-3 py-1.5 text-xs text-warning backdrop-blur-sm">
              AI 服务未配置。
              <button
                type="button"
                className="ml-1 cursor-pointer underline underline-offset-2 hover:text-foreground"
                onClick={openSettings}
              >
                前往设置
              </button>
            </div>
          )}
          {llmError ? <LlmErrorAlert error={llmError} /> : null}
          {appNotice ? (
            <div className="rounded-none border border-warning/25 bg-warning/5 px-3 py-1.5 text-xs leading-relaxed text-warning backdrop-blur-sm">
              {appNotice}
            </div>
          ) : null}
          <ConversationComposer
            value={input}
            onChange={setInput}
            mode={mode}
            onModeChange={setMode}
            delegateMaxTurns={delegateMaxTurns}
            onDelegateMaxTurnsChange={setDelegateMaxTurns}
            onSend={send}
            onStop={() => void window.storyStudio.agent.cancel()}
            loading={loading}
            disabled={!llmConfigured}
            canSend={Boolean(activeConversationId && llmConfigured && input.trim())}
            placeholder={
              mode === "delegate"
                ? llmConfigured
                  ? "描述托管目标，例如：完善第三章并写入文件…"
                  : "请先在设置中配置 API Key"
                : llmConfigured
                  ? "对 Story Studio 说…"
                  : "请先在设置中配置 API Key"
            }
            contextUsage={contextUsage}
            delegateSession={delegateSession}
          />
        </div>
      </div>
    </section>
  );

  const conversationPanel = (
    <ResizablePanel
      id="conversation"
      panelRef={panel.conversationPanelRef}
      defaultSize={panelPct(DEFAULT_APP_CONTENT_LAYOUT.conversation)}
      minSize={panelPx(PANEL_MIN_PX.conversation)}
      className="min-w-0"
    >
      {conversationSection}
    </ResizablePanel>
  );

  const workspacePanel = (
    <ResizablePanel
      id="workspace"
      panelRef={panel.workspacePanelRef}
      collapsible
      collapsedSize={0}
      defaultSize={panelPct(DEFAULT_APP_CONTENT_LAYOUT.workspace)}
      minSize={panelPx(PANEL_MIN_PX.workspace)}
      maxSize={panelPct(76)}
      className="min-w-0 overflow-hidden"
      onResize={(size) => {
        panel.handleWorkspacePanelResize(size.asPercentage);
      }}
    >
      <WorkWorkspacePanel
        ref={workspaceFilesRef}
        work={activeWorkspace}
        refreshKey={String(activeWorkspace?.revision ?? 0)}
        onWorkUpdated={setActiveWorkspace}
      />
    </ResizablePanel>
  );

  const contentPanelHandle = (
    <ResizableHandle
      className={panel.workspacePanelCollapsed ? "hidden" : undefined}
    />
  );

  const layoutLeadingControls = activeConversationId ? (
    <ContentLayoutToggle onClick={toggleContentLayout} />
  ) : null;

  const sidebar = (
    <WorkspaceSidebar
      workspaces={sidebarWorkspaces}
      activeWorkPath={activeWorkspace?.workPath ?? null}
      activeConversationId={activeConversationId}
      expandedWorkPaths={expandedWorkPaths}
      onNewConversation={handleNewConversation}
      onNewConversationInWorkspace={handleNewConversationInWorkspace}
      onOpenWorkspace={openCreateWorkspaceDialog}
      onToggleWorkspace={toggleWorkspace}
      onSelectConversation={selectConversation}
      onDeleteConversation={deleteConversation}
      onRemoveWorkspace={removeWorkspace}
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ResizablePanelGroup
        id={PANEL_LAYOUT_IDS.appShell}
        groupRef={sidebarPanel.shellGroupRef}
        direction="horizontal"
        className="min-h-0 min-w-0 flex-1 overflow-hidden"
        defaultLayout={
          readPanelLayout(PANEL_LAYOUT_IDS.appShell) ?? DEFAULT_APP_SHELL_LAYOUT
        }
        onLayoutChanged={(layout, meta) => {
          if (meta.isUserInteraction) {
            savePanelLayout(PANEL_LAYOUT_IDS.appShell, layout);
          }
          sidebarPanel.recordVisibleShellLayout(layout);
        }}
      >
        <ResizablePanel
          id="sidebar"
          panelRef={sidebarPanel.sidebarPanelRef}
          collapsible
          collapsedSize={0}
          defaultSize={panelPct(DEFAULT_APP_SHELL_LAYOUT.sidebar)}
          minSize={panelPx(PANEL_MIN_PX.sidebar)}
          maxSize={panelPx(PANEL_MAX_PX.sidebar)}
          className="min-w-0"
          onResize={(size) => {
            sidebarPanel.handleSidebarPanelResize(size.asPercentage);
          }}
        >
          <div
            ref={sidebarMeasureRef}
            className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
          >
            <AppSidebarChrome
              onToggleSidebar={sidebarPanel.toggleSidebarPanel}
              leadingControls={layoutLeadingControls}
            />
            <div className="min-h-0 flex-1 overflow-hidden">{sidebar}</div>
          </div>
        </ResizablePanel>

        <ResizableHandle
          className={sidebarPanel.sidebarPanelCollapsed ? "hidden" : undefined}
        />

        <ResizablePanel
          id="main"
          defaultSize={panelPct(DEFAULT_APP_SHELL_LAYOUT.main)}
          minSize={panelPx(PANEL_MIN_PX.main)}
          className="min-w-0"
        >
          {showSettings ? (
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
              <AppPanelHeader
                inset="flush"
                sidebarCollapsed={sidebarPanel.sidebarPanelCollapsed}
                onToggleSidebar={sidebarPanel.toggleSidebarPanel}
              >
                <PanelHeaderBackButton onClick={closeSettings} />
              </AppPanelHeader>
              <div className="min-h-0 flex-1 overflow-hidden">
                <SettingsScreen initialSectionId={settingsSectionId} />
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
              <AppPanelHeader
                sidebarCollapsed={sidebarPanel.sidebarPanelCollapsed}
                onToggleSidebar={sidebarPanel.toggleSidebarPanel}
                leadingControls={layoutLeadingControls}
                trailing={
                  <>
                    <PanelHeaderIconButton
                      aria-label="快捷键"
                      title={`快捷键 (${formatShortcut(["mod", "/"])})`}
                      onClick={() => setShortcutsOpen(true)}
                    >
                      <Keyboard className="h-4 w-4" strokeWidth={1.75} />
                    </PanelHeaderIconButton>
                    <PanelHeaderIconButton
                      aria-label="设置"
                      title={`设置 (${formatShortcut(["mod", ","])})`}
                      onClick={openQuickSettings}
                    >
                      <Settings2 className="h-4 w-4" strokeWidth={1.75} />
                    </PanelHeaderIconButton>
                    {activeConversationId ? (
                      <WorkspacePanelToggle
                        collapsed={panel.workspacePanelCollapsed}
                        onClick={panel.toggleWorkspacePanel}
                      />
                    ) : null}
                  </>
                }
              >
                {!activeConversationId ? (
                  <span className="truncate text-xs leading-7 text-muted-foreground">
                    新建对话
                  </span>
                ) : conversationContextLabel ? (
                  <span className="truncate text-xs leading-7 text-muted-foreground">
                    {conversationContextLabel}
                  </span>
                ) : null}
              </AppPanelHeader>
              {!activeConversationId ? (
                <div className="surface-sidebar min-h-0 flex-1">
                  <CreateConversationComposer
                    className="h-full"
                    workspaces={workspaceOptions}
                    defaultWorkPath={composeDefaultWorkPath}
                    mode={mode}
                    onModeChange={setMode}
                    delegateMaxTurns={delegateMaxTurns}
                    onDelegateMaxTurnsChange={setDelegateMaxTurns}
                    onCreateWorkspace={openCreateWorkspaceDialog}
                    onCreate={startNewConversation}
                    onCancel={closeComposeConversation}
                  />
                </div>
              ) : (
              <ResizablePanelGroup
                id={PANEL_LAYOUT_IDS.appContent}
                groupRef={panel.contentGroupRef}
                direction="horizontal"
                className="min-h-0 min-w-0 flex-1 overflow-hidden"
                defaultLayout={
                  readPanelLayout(PANEL_LAYOUT_IDS.appContent) ??
                  DEFAULT_APP_CONTENT_LAYOUT
                }
                onLayoutChanged={(layout, meta) => {
                  if (meta.isUserInteraction) {
                    savePanelLayout(PANEL_LAYOUT_IDS.appContent, layout);
                  }
                  panel.recordVisibleContentLayout(layout);
                }}
              >
                {contentLayoutSwapped ? (
                  <>
                    {workspacePanel}
                    {contentPanelHandle}
                    {conversationPanel}
                  </>
                ) : (
                  <>
                    {conversationPanel}
                    {contentPanelHandle}
                    {workspacePanel}
                  </>
                )}
              </ResizablePanelGroup>
              )}
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
      <CreateWorkspaceDialog
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
        onCreated={(workPath) => void handleWorkspaceCreated(workPath)}
      />
    </div>
  );
}
