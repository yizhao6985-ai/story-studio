import { useEventListener } from "ahooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConversationManifest, WorkSnapshot } from "@/lib/story";

import type { WorkspaceFilesHandle } from "@/features/work-workspace-panel";

import {
  clearAppSession,
  readAppSession,
  saveAppSession,
} from "@/lib/app-session";
import { resolveRunFailure, type LlmErrorDisplay } from "@/lib/agent-error-display";
import { useAppKeyboardShortcuts } from "@/hooks/keyboard/use-app-keyboard-shortcuts";
import { useComposerModeCycleShortcut } from "@/hooks/keyboard/use-composer-mode-cycle-shortcut";
import { useSidebarPanelCollapse } from "@/hooks/layout/use-sidebar-panel-collapse";
import { useWorkspacePanelCollapse } from "@/hooks/layout/use-workspace-panel-collapse";
import { useSidebarWorkspaces } from "@/hooks/workspace/use-sidebar-workspaces";
import { useLangGraphChat } from "@/hooks/chat/use-langgraph-chat";
import type { AgentMode, WorkspaceEntry } from "@/hooks/types";
import type { WorkspaceSidebarEntry } from "@/features/workspace-sidebar";
import type { SettingsSectionId } from "@/features/settings/settings-sections";
import {
  OPEN_SETTINGS_EVENT,
  type OpenSettingsDetail,
} from "@/lib/settings-navigation";
import {
  createConversation,
  deleteConversation,
  getThreadMetadata,
  updateConversationMode,
  listConversations,
} from "@/lib/langgraph";

export function useAppShellState() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkSnapshot | null>(null);
  const [conversationsMap, setConversationsMap] = useState<
    Record<string, ConversationManifest[]>
  >({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mode, setModeState] = useState<AgentMode>("normal");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSectionId, setSettingsSectionId] =
    useState<SettingsSectionId>("appearance");
  const [composeDefaultWorkPath, setComposeDefaultWorkPath] = useState<string | undefined>();
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [llmError, setLlmError] = useState<LlmErrorDisplay | null>(null);
  const [appNotice, setAppNotice] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarMeasureRef = useRef<HTMLDivElement>(null);
  const workspaceFilesRef = useRef<WorkspaceFilesHandle>(null);
  const sessionRestoredRef = useRef(false);
  const activeConversationKeyRef = useRef("");

  const {
    workspaceEntries,
    workspaceRegistryLoaded,
    expandedWorkPaths,
    addWorkspaceToSidebar,
    expandWorkspace,
    toggleWorkspace,
    cacheManifest,
    removeWorkspaceFromSidebar,
  } = useSidebarWorkspaces(activeWorkspace);
  const panel = useWorkspacePanelCollapse();
  const sidebarPanel = useSidebarPanelCollapse();

  const loadConversationsFor = useCallback(async (workPath: string) => {
    const list = await listConversations(workPath);
    setConversationsMap((prev) => ({ ...prev, [workPath]: list }));
    return list;
  }, []);

  const refreshAllConversations = useCallback(async (entries: WorkspaceEntry[]) => {
    const pairs = await Promise.all(
      entries.map(async ({ workPath }) => {
        const list = await listConversations(workPath);
        return [workPath, list] as const;
      }),
    );
    setConversationsMap(Object.fromEntries(pairs));
  }, []);

  useEffect(() => {
    if (workspaceEntries.length === 0) return;
    void refreshAllConversations(workspaceEntries);
  }, [
    workspaceEntries.map((entry) => entry.workPath).join("\0"),
    refreshAllConversations,
  ]);

  const syncActiveWorkspace = useCallback(async () => {
    const workPath = activeWorkspace?.workPath;
    if (!workPath) return;

    const snap = await window.storyStudio.library.openWork(workPath);
    setActiveWorkspace(snap);
    cacheManifest(workPath, snap.manifest);
  }, [activeWorkspace?.workPath, cacheManifest]);

  const refreshWorkspaceAfterChat = useCallback(async () => {
    const workPath = activeWorkspace?.workPath;
    if (!workPath) return;

    await syncActiveWorkspace();
    if (activeConversationId) {
      await loadConversationsFor(workPath);
    }
  }, [
    activeWorkspace?.workPath,
    activeConversationId,
    syncActiveWorkspace,
    loadConversationsFor,
  ]);

  const {
    messages,
    sendMessage,
    stop,
    loading,
    streamingMessageId,
    showTypingIndicator,
    error: chatError,
  } = useLangGraphChat({
    workPath: activeWorkspace?.workPath,
    threadId: activeConversationId ?? undefined,
    mode,
    onFinish: () => {
      void refreshWorkspaceAfterChat();
    },
    onWorkspaceMutated: () => {
      void syncActiveWorkspace();
    },
    onError: (error) => {
      const resolved = resolveRunFailure(error);
      if (resolved.llm) setLlmError(resolved.llm);
      if (resolved.appNotice) setAppNotice(resolved.appNotice);
    },
  });

  useEffect(() => {
    if (chatError) {
      const resolved = resolveRunFailure(chatError);
      if (resolved.llm) setLlmError(resolved.llm);
      if (resolved.appNotice) setAppNotice(resolved.appNotice);
    }
  }, [chatError]);

  const activateConversation = useCallback(
    async (workPath: string, conversationId: string) => {
      const key = `${workPath}\0${conversationId}`;
      activeConversationKeyRef.current = key;
      setActiveConversationId(conversationId);
      saveAppSession({ workPath, conversationId });

      const metadata = await getThreadMetadata(conversationId);
      if (metadata) {
        if (metadata.workPath !== workPath) {
          throw new Error("THREAD_WORKSPACE_MISMATCH");
        }
        setModeState(metadata.mode);
      }

      const snap = await window.storyStudio.library.openWork(workPath);
      if (activeConversationKeyRef.current !== key) return;

      cacheManifest(workPath, snap.manifest);
      setActiveWorkspace(snap);
      expandWorkspace(workPath);
    },
    [cacheManifest, expandWorkspace],
  );

  const setMode = useCallback(
    (nextMode: AgentMode) => {
      setModeState(nextMode);
      if (activeConversationId) {
        void updateConversationMode(activeConversationId, nextMode);
      }
    },
    [activeConversationId],
  );

  useEffect(() => {
    if (sessionRestoredRef.current) return;
    if (!workspaceRegistryLoaded) return;

    if (workspaceEntries.length === 0) {
      sessionRestoredRef.current = true;
      return;
    }

    const session = readAppSession();
    if (!session) {
      sessionRestoredRef.current = true;
      return;
    }

    const { workPath, conversationId } = session;
    if (!workspaceEntries.some((entry) => entry.workPath === workPath)) {
      clearAppSession();
      sessionRestoredRef.current = true;
      return;
    }

    const conversations = conversationsMap[workPath];
    if (conversations === undefined) return;

    if (!conversations.some((item) => item.id === conversationId)) {
      clearAppSession();
      sessionRestoredRef.current = true;
      return;
    }

    sessionRestoredRef.current = true;
    void activateConversation(workPath, conversationId);
  }, [
    workspaceRegistryLoaded,
    workspaceEntries,
    conversationsMap,
    activateConversation,
  ]);

  const registerWorkspace = useCallback(
    async (snap: WorkSnapshot) => {
      const { workPath } = snap;
      cacheManifest(workPath, snap.manifest);
      await addWorkspaceToSidebar(workPath);
      await loadConversationsFor(workPath);
      expandWorkspace(workPath);
      setActiveWorkspace(snap);
      return snap;
    },
    [cacheManifest, addWorkspaceToSidebar, expandWorkspace, loadConversationsFor],
  );

  const openCreateWorkspaceDialog = useCallback(() => {
    setCreateWorkspaceOpen(true);
  }, []);

  const previewComposeWorkspace = useCallback(
    async (workPath: string) => {
      const snap = await window.storyStudio.library.openWork(workPath);
      setActiveWorkspace(snap);
      cacheManifest(workPath, snap.manifest);
    },
    [cacheManifest],
  );

  const handleWorkspaceCreated = useCallback(
    async (workPath: string) => {
      const snap = await window.storyStudio.library.openWork(workPath);
      await registerWorkspace(snap);
      if (!activeConversationId) {
        setComposeDefaultWorkPath(workPath);
      }
    },
    [activeConversationId, registerWorkspace],
  );

  const openComposeConversation = useCallback(
    (defaultWorkPath?: string) => {
      setComposeDefaultWorkPath(defaultWorkPath);
      setActiveConversationId(null);
      if (defaultWorkPath) {
        void window.storyStudio.library.openWork(defaultWorkPath).then((snap) => {
          setActiveWorkspace(snap);
          cacheManifest(defaultWorkPath, snap.manifest);
        });
      } else {
        setActiveWorkspace(null);
      }
    },
    [cacheManifest],
  );

  const closeComposeConversation = useCallback(() => {
    setComposeDefaultWorkPath(undefined);
    const session = readAppSession();
    if (
      session &&
      workspaceEntries.some((entry) => entry.workPath === session.workPath)
    ) {
      void activateConversation(session.workPath, session.conversationId);
    }
  }, [workspaceEntries, activateConversation]);

  const handleNewConversation = useCallback(() => {
    if (workspaceEntries.length === 0) {
      openComposeConversation();
      return;
    }
    openComposeConversation(activeWorkspace?.workPath);
  }, [workspaceEntries.length, openComposeConversation, activeWorkspace?.workPath]);

  const handleNewConversationInWorkspace = useCallback(
    (workPath: string) => {
      openComposeConversation(workPath);
    },
    [openComposeConversation],
  );

  const submitChatText = useCallback(
    async (
      text: string,
      workPath = activeWorkspace?.workPath,
      conversationId = activeConversationId ?? undefined,
    ) => {
      const trimmed = text.trim();
      if (!workPath || !conversationId || !trimmed || loading) return;

      setLlmError(null);
      setAppNotice("");
      await sendMessage(trimmed, { workPath, threadId: conversationId });
    },
    [activeWorkspace?.workPath, activeConversationId, loading, sendMessage],
  );

  const startNewConversation = useCallback(
    async (workPath: string, initialMessage: string) => {
      const created = await createConversation(workPath, mode);
      await loadConversationsFor(workPath);
      await activateConversation(workPath, created.id);
      setComposeDefaultWorkPath(undefined);

      const trimmed = initialMessage.trim();
      if (!trimmed) return;

      setLlmError(null);
      setAppNotice("");
      try {
        await sendMessage(trimmed, { workPath, threadId: created.id });
      } catch (error) {
        const resolved = resolveRunFailure(error);
        if (resolved.llm) setLlmError(resolved.llm);
        if (resolved.appNotice) setAppNotice(resolved.appNotice);
      }
    },
    [loadConversationsFor, activateConversation, sendMessage, mode],
  );

  const send = useCallback(async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try {
      await submitChatText(text);
    } catch (error) {
      setInput(text);
      const resolved = resolveRunFailure(error);
      if (resolved.llm) setLlmError(resolved.llm);
      if (resolved.appNotice) setAppNotice(resolved.appNotice);
    }
  }, [input, submitChatText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const openQuickSettings = useCallback(() => {
    setComposeDefaultWorkPath(undefined);
    setSettingsSectionId("appearance");
    setShowSettings(true);
  }, []);

  useEventListener(
    OPEN_SETTINGS_EVENT,
    (event) => {
      const detail = (event as CustomEvent<OpenSettingsDetail>).detail;
      if (detail?.section) {
        setSettingsSectionId(detail.section);
      }
      setShowSettings(true);
    },
  );

  useAppKeyboardShortcuts({
    showSettings,
    hasActiveConversation: activeConversationId != null,
    onOpenShortcuts: () => setShortcutsOpen(true),
    onOpenSettings: openQuickSettings,
    onToggleWorkspacePanel: panel.toggleWorkspacePanel,
    onCloseFileOrApp: () => {
      if (workspaceFilesRef.current) {
        workspaceFilesRef.current.closeCurrentOrApp();
        return;
      }
      void window.storyStudio.app.closeWindow();
    },
  });

  useComposerModeCycleShortcut({
    mode,
    onModeChange: setMode,
    disabled: showSettings,
  });

  const sidebarWorkspaces = useMemo<WorkspaceSidebarEntry[]>(
    () =>
      workspaceEntries.map(({ manifest, workPath }) => ({
        workPath,
        title: manifest.title,
        conversations: conversationsMap[workPath] ?? [],
      })),
    [workspaceEntries, conversationsMap],
  );

  const activeConversation =
    activeWorkspace &&
    (conversationsMap[activeWorkspace.workPath] ?? []).find(
      (item) => item.id === activeConversationId,
    );

  const conversationContextLabel =
    activeConversation && activeWorkspace
      ? `${activeWorkspace.manifest.title} · ${activeConversation.title}`
      : activeWorkspace?.manifest.title;

  const workspaceOptions = useMemo(
    () =>
      sidebarWorkspaces.map((workspace) => ({
        workPath: workspace.workPath,
        title: workspace.title,
      })),
    [sidebarWorkspaces],
  );

  const selectConversation = useCallback(
    (workPath: string, conversationId: string) => {
      closeSettings();
      setComposeDefaultWorkPath(undefined);
      void activateConversation(workPath, conversationId);
    },
    [closeSettings, activateConversation],
  );

  const deleteConversationById = useCallback(
    async (workPath: string, conversationId: string) => {
      await deleteConversation(conversationId);
      await loadConversationsFor(workPath);

      if (activeConversationId !== conversationId) return;

      setActiveConversationId(null);
      setInput("");
      setLlmError(null);
      setAppNotice("");
      clearAppSession();

      if (activeWorkspace?.workPath === workPath) {
        setComposeDefaultWorkPath(workPath);
      }
    },
    [activeConversationId, activeWorkspace?.workPath, loadConversationsFor],
  );

  const removeWorkspace = useCallback(
    (workPath: string) => {
      void removeWorkspaceFromSidebar(workPath);
      setConversationsMap((prev) => {
        if (!(workPath in prev)) return prev;
        const next = { ...prev };
        delete next[workPath];
        return next;
      });

      if (activeWorkspace?.workPath === workPath) {
        setActiveWorkspace(null);
        setActiveConversationId(null);
        setInput("");
        setLlmError(null);
        setAppNotice("");
        clearAppSession();
      }

      if (composeDefaultWorkPath === workPath) {
        setComposeDefaultWorkPath(undefined);
      }
    },
    [removeWorkspaceFromSidebar, activeWorkspace?.workPath, composeDefaultWorkPath],
  );

  return {
    sidebarMeasureRef,
    messagesEndRef,
    workspaceFilesRef,
    sidebarWorkspaces,
    workspaceEntries,
    workspaceOptions,
    expandedWorkPaths,
    activeWorkspace,
    setActiveWorkspace,
    activeConversationId,
    mode,
    setMode,
    input,
    setInput,
    chatMessages: messages,
    chatLoading: loading,
    chatStreamingMessageId: streamingMessageId,
    chatShowTypingIndicator: showTypingIndicator,
    loading,
    stopChat: stop,
    showSettings,
    settingsSectionId,
    composeDefaultWorkPath,
    createWorkspaceOpen,
    setCreateWorkspaceOpen,
    llmError,
    appNotice,
    shortcutsOpen,
    setShortcutsOpen,
    conversationContextLabel,
    panel,
    sidebarPanel,
    openCreateWorkspaceDialog,
    previewComposeWorkspace,
    handleWorkspaceCreated,
    closeComposeConversation,
    handleNewConversation,
    handleNewConversationInWorkspace,
    startNewConversation,
    toggleWorkspace,
    send,
    openQuickSettings,
    closeSettings,
    selectConversation,
    deleteConversation: deleteConversationById,
    removeWorkspace,
  };
}
