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
import { useSidebarPanelCollapse } from "@/hooks/layout/use-sidebar-panel-collapse";
import { useWorkspacePanelCollapse } from "@/hooks/layout/use-workspace-panel-collapse";
import { useSidebarWorkspaces } from "@/hooks/workspace/use-sidebar-workspaces";
import { useStudioChat } from "@/hooks/chat/use-studio-chat";
import type {
  AgentMode,
  ComposerMode,
  DelegateSessionInfo,
  WorkspaceEntry,
} from "@/hooks/types";
import { DEFAULT_DELEGATE_MAX_TURNS } from "@/hooks/types";
import type { WorkspaceSidebarEntry } from "@/features/workspace-sidebar";
import type { ContextUsageInfo } from "@/features/context-usage-meter";
import type { SettingsSectionId } from "@/features/settings/settings-sections";
import {
  OPEN_SETTINGS_EVENT,
  type OpenSettingsDetail,
} from "@/lib/settings-navigation";
import {
  loadChatMessages,
  getContextUsage,
  ensureThread,
  deleteThread,
} from "@/lib/mastra";

export function useAppShellState() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkSnapshot | null>(null);
  const [conversationsMap, setConversationsMap] = useState<
    Record<string, ConversationManifest[]>
  >({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ComposerMode>("normal");
  const [delegateMaxTurns, setDelegateMaxTurns] = useState(DEFAULT_DELEGATE_MAX_TURNS);
  const [delegateSession, setDelegateSession] = useState<DelegateSessionInfo | null>(
    null,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSectionId, setSettingsSectionId] =
    useState<SettingsSectionId>("appearance");
  const [composeDefaultWorkPath, setComposeDefaultWorkPath] = useState<string | undefined>();
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [llmError, setLlmError] = useState<LlmErrorDisplay | null>(null);
  const [appNotice, setAppNotice] = useState("");
  const [contextUsage, setContextUsage] = useState<ContextUsageInfo | null>(null);
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
    const list = await window.storyStudio.library.listConversations(workPath);
    setConversationsMap((prev) => ({ ...prev, [workPath]: list }));
    return list;
  }, []);

  const refreshAllConversations = useCallback(async (entries: WorkspaceEntry[]) => {
    const pairs = await Promise.all(
      entries.map(async ({ workPath }) => {
        const list = await window.storyStudio.library.listConversations(workPath);
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

  const agentModeForContext: AgentMode = mode === "delegate" ? "normal" : mode;

  const refreshContextUsage = useCallback(
    async (draftMessage?: string) => {
      const workPath = activeWorkspace?.workPath;
      if (!workPath || !activeConversationId) {
        setContextUsage(null);
        return;
      }

      try {
        const usage = await getContextUsage({
          workPath,
          conversationId: activeConversationId,
          mode: agentModeForContext,
          draftMessage: draftMessage ?? "",
        });
        setContextUsage({
          percent: usage.percent,
          usedTokens: usage.usedTokens,
          budgetTokens: usage.maxTokens,
          hasSummary: false,
          modelLabel: usage.modelLabel,
        });
      } catch {
        setContextUsage(null);
      }
    },
    [activeWorkspace?.workPath, activeConversationId, agentModeForContext],
  );

  const refreshWorkspaceAfterChat = useCallback(async () => {
    const workPath = activeWorkspace?.workPath;
    if (!workPath || !activeConversationId) return;

    await window.storyStudio.library.touchConversation(
      workPath,
      activeConversationId,
    );
    const snap = await window.storyStudio.library.openWork(workPath);
    setActiveWorkspace(snap);
    cacheManifest(workPath, snap.manifest);
    await loadConversationsFor(workPath);
    void refreshContextUsage();
  }, [
    activeWorkspace?.workPath,
    activeConversationId,
    cacheManifest,
    loadConversationsFor,
    refreshContextUsage,
  ]);

  const {
    messages,
    setMessages,
    sendMessage,
    stop,
    status,
    loading,
    error: chatError,
  } = useStudioChat({
    workPath: activeWorkspace?.workPath,
    conversationId: activeConversationId ?? undefined,
    mode,
    delegateMaxTurns,
    onFinish: () => {
      void refreshWorkspaceAfterChat();
      setDelegateSession(null);
    },
    onError: (error) => {
      const resolved = resolveRunFailure(error);
      if (resolved.llm) setLlmError(resolved.llm);
      if (resolved.appNotice) setAppNotice(resolved.appNotice);
      setDelegateSession(null);
    },
    onData: (part) => {
      if (part.type === "data-delegate-status") {
        setDelegateSession({
          status: "running",
          turn: part.data.turn,
          maxTurns: part.data.maxTurns,
          artifactPaths: part.data.artifactPaths,
          goal: part.data.goal,
        });
      }
      if (part.type === "data-delegate-complete") {
        setDelegateSession(null);
      }
    },
  });

  useEffect(() => {
    if (chatError) {
      const resolved = resolveRunFailure(chatError);
      if (resolved.llm) setLlmError(resolved.llm);
      if (resolved.appNotice) setAppNotice(resolved.appNotice);
    }
  }, [chatError]);

  useEffect(() => {
    void refreshContextUsage(input);
  }, [activeConversationId, activeWorkspace?.workPath, agentModeForContext]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshContextUsage(input);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input, refreshContextUsage]);

  const loadConversationMessages = useCallback(
    async (workPath: string, conversationId: string) => {
      const key = `${workPath}\0${conversationId}`;
      setMessages([]);
      try {
        const history = await loadChatMessages({ workPath, conversationId });
        if (activeConversationKeyRef.current !== key) return;
        setMessages(history);
      } catch {
        if (activeConversationKeyRef.current !== key) return;
        setMessages([]);
      }
    },
    [setMessages],
  );

  const activateConversation = useCallback(
    async (workPath: string, conversationId: string) => {
      const key = `${workPath}\0${conversationId}`;
      activeConversationKeyRef.current = key;
      setMessages([]);
      setActiveConversationId(conversationId);
      saveAppSession({ workPath, conversationId });

      const snap = await window.storyStudio.library.openWork(workPath);
      if (activeConversationKeyRef.current !== key) return;

      cacheManifest(workPath, snap.manifest);
      setActiveWorkspace(snap);
      expandWorkspace(workPath);
      await loadConversationMessages(workPath, conversationId);
    },
    [cacheManifest, expandWorkspace, loadConversationMessages, setMessages],
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
      setMessages([]);
      if (defaultWorkPath) {
        void window.storyStudio.library.openWork(defaultWorkPath).then((snap) => {
          setActiveWorkspace(snap);
          cacheManifest(defaultWorkPath, snap.manifest);
        });
      } else {
        setActiveWorkspace(null);
      }
    },
    [cacheManifest, setMessages],
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

      if (mode === "delegate") {
        setDelegateSession({
          status: "running",
          turn: 0,
          maxTurns: delegateMaxTurns,
          artifactPaths: [],
          goal: trimmed,
        });
      }

      await sendMessage({ text: trimmed });
    },
    [
      activeWorkspace?.workPath,
      activeConversationId,
      loading,
      mode,
      delegateMaxTurns,
      sendMessage,
    ],
  );

  const startNewConversation = useCallback(
    async (workPath: string, initialMessage: string) => {
      const created = await window.storyStudio.library.createConversation(workPath);
      await ensureThread({
        workPath,
        conversationId: created.id,
        title: created.title,
      });
      await loadConversationsFor(workPath);
      await activateConversation(workPath, created.id);
      setComposeDefaultWorkPath(undefined);

      if (initialMessage.trim()) {
        await submitChatText(initialMessage, workPath, created.id);
      }
    },
    [loadConversationsFor, activateConversation, submitChatText],
  );

  const send = useCallback(async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    await submitChatText(text);
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

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenSettingsDetail>).detail;
      if (detail?.section) {
        setSettingsSectionId(detail.section);
      }
      setShowSettings(true);
    };

    window.addEventListener(OPEN_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
  }, []);

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

  const deleteConversation = useCallback(
    async (workPath: string, conversationId: string) => {
      await deleteThread({ workPath, threadId: conversationId });
      await window.storyStudio.library.deleteConversation(workPath, conversationId);
      await loadConversationsFor(workPath);

      if (activeConversationId !== conversationId) return;

      setActiveConversationId(null);
      setMessages([]);
      setInput("");
      setLlmError(null);
      setAppNotice("");
      clearAppSession();

      if (activeWorkspace?.workPath === workPath) {
        setComposeDefaultWorkPath(workPath);
      }
    },
    [
      activeConversationId,
      activeWorkspace?.workPath,
      loadConversationsFor,
      setMessages,
    ],
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
        setMessages([]);
        setInput("");
        setLlmError(null);
        setAppNotice("");
        clearAppSession();
      }

      if (composeDefaultWorkPath === workPath) {
        setComposeDefaultWorkPath(undefined);
      }
    },
    [
      removeWorkspaceFromSidebar,
      activeWorkspace?.workPath,
      composeDefaultWorkPath,
      setMessages,
    ],
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
    delegateMaxTurns,
    setDelegateMaxTurns,
    input,
    setInput,
    chatMessages: messages,
    chatStatus: status,
    loading,
    stopChat: stop,
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
    deleteConversation,
    removeWorkspace,
  };
}
