import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConversationManifest, WorkSnapshot } from "@/lib/story";

import type { WorkspaceFilesHandle } from "@/features/work-workspace-panel";

import {
  clearAppSession,
  readAppSession,
  saveAppSession,
} from "@/lib/app-session";
import { formatLlmErrorMessage, isAbortError } from "@/lib/api-error-message";
import { useAppKeyboardShortcuts } from "@/hooks/keyboard/use-app-keyboard-shortcuts";
import { useSidebarPanelCollapse } from "@/hooks/layout/use-sidebar-panel-collapse";
import { useWorkspacePanelCollapse } from "@/hooks/layout/use-workspace-panel-collapse";
import { useLlmConfigured } from "@/hooks/settings/use-llm-configured";
import { useSidebarWorkspaces } from "@/hooks/workspace/use-sidebar-workspaces";
import type {
  ActivityEntry,
  AgentActivityEvent,
  AgentMode,
  ChatMessage,
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

export function useAppShellState() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkSnapshot | null>(null);
  const [conversationsMap, setConversationsMap] = useState<
    Record<string, ConversationManifest[]>
  >({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [composerError, setComposerError] = useState("");
  const [contextUsage, setContextUsage] = useState<ContextUsageInfo | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarMeasureRef = useRef<HTMLDivElement>(null);
  const workspaceFilesRef = useRef<WorkspaceFilesHandle>(null);
  const sessionRestoredRef = useRef(false);
  const activeConversationKeyRef = useRef("");

  const { configured: llmConfigured, refresh: refreshLlmStatus, setConfigured: setLlmConfigured } =
    useLlmConfigured();
  const llmReady = llmConfigured ?? true;

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

  const loadConversationMessages = useCallback(
    async (workPath: string, conversationId: string) => {
      const key = `${workPath}\0${conversationId}`;
      setMessages([]);
      const history = await window.storyStudio.library.loadConversationMessages(
        workPath,
        conversationId,
      );
      if (activeConversationKeyRef.current !== key) return;
      setMessages(history as ChatMessage[]);
    },
    [],
  );

  const agentModeForContext: AgentMode = mode === "delegate" ? "normal" : mode;

  const refreshContextUsage = useCallback(
    async (draftMessage?: string) => {
      const workPath = activeWorkspace?.workPath;
      if (!workPath || !activeConversationId || !llmReady) {
        setContextUsage(null);
        return;
      }

      try {
        const usage = await window.storyStudio.agent.getContextUsage({
          workPath,
          conversationId: activeConversationId,
          mode: agentModeForContext,
          draftMessage: draftMessage ?? "",
        });
        setContextUsage(usage);
      } catch {
        setContextUsage(null);
      }
    },
    [activeWorkspace?.workPath, activeConversationId, agentModeForContext, llmReady],
  );

  useEffect(() => {
    void refreshContextUsage(input);
  }, [activeConversationId, activeWorkspace?.workPath, agentModeForContext, llmReady]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshContextUsage(input);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input, refreshContextUsage]);

  const applyAssistantActivity = useCallback(
    (event: AgentActivityEvent) => {
      setMessages((m) => {
        const next = [...m];
        const idx = next.length - 1;
        const last = next[idx];
        if (last?.role !== "assistant" || !last.streaming) return m;

        switch (event.type) {
          case "status":
            next[idx] = { ...last, agentStatus: event.status };
            break;
          case "subtasks":
            next[idx] = { ...last, subtasks: event.subtasks };
            break;
          case "step":
            next[idx] = {
              ...last,
              activityLog: [...(last.activityLog ?? []), event.entry],
            };
            break;
          case "reply_delta":
            next[idx] = { ...last, text: last.text + event.delta };
            break;
          case "done":
            next[idx] = {
              ...last,
              text: event.reply ?? last.text,
              streaming: false,
            };
            void refreshContextUsage();
            break;
          case "context_compacted":
            void refreshContextUsage();
            break;
          case "error":
            break;
          default:
            return m;
        }
        return next;
      });
    },
    [refreshContextUsage],
  );

  const appendDelegateSummary = useCallback(
    (input: {
      status: DelegateSessionInfo["status"];
      summary: string;
      artifactPaths: string[];
      turns: number;
    }) => {
      setMessages((m) => [
        ...m,
        {
          role: "delegate_summary",
          text: input.summary,
          status: input.status,
          artifactPaths: input.artifactPaths,
          turns: input.turns,
        },
      ]);
    },
    [],
  );

  const applyDelegateActivity = useCallback(
    (event: AgentActivityEvent) => {
      switch (event.type) {
        case "delegate_turn":
          setMessages((m) => [
            ...m,
            { role: "delegate", text: event.message, turn: event.turn },
            {
              role: "assistant",
              text: "",
              streaming: true,
              activityLog: [],
              subtasks: [],
              agentStatus: "planning",
            },
          ]);
          break;
        case "delegate_status":
          setDelegateSession({
            status: "running",
            turn: event.turn,
            maxTurns: event.maxTurns,
            artifactPaths: event.artifactPaths,
            goal: event.goal,
          });
          break;
        case "delegate_complete":
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === "assistant" && last.streaming) {
              next[next.length - 1] = { ...last, streaming: false };
            }
            return next;
          });
          appendDelegateSummary({
            status: event.status,
            summary: event.summary,
            artifactPaths: event.artifactPaths,
            turns: event.turns,
          });
          setDelegateSession(null);
          break;
        default:
          applyAssistantActivity(event);
      }
    },
    [appendDelegateSummary, applyAssistantActivity],
  );

  const sendMessage = useCallback(
    async (
      text: string,
      workPath = activeWorkspace?.workPath,
      conversationId = activeConversationId ?? undefined,
    ) => {
      const trimmed = text.trim();
      if (!workPath || !conversationId || !trimmed || loading || !llmReady) {
        return;
      }
      if (mode === "delegate") {
        return;
      }

      const agentMode = mode as AgentMode;
      setInput("");
      setComposerError("");
      setMessages((m) => [
        ...m,
        { role: "user", text: trimmed },
        {
          role: "assistant",
          text: "",
          streaming: true,
          activityLog: [],
          subtasks: [],
          agentStatus: "planning",
        },
      ]);
      setLoading(true);

      try {
        const result = await window.storyStudio.agent.run(
          {
            workPath,
            conversationId,
            message: trimmed,
            mode: agentMode,
          },
          applyAssistantActivity as NonNullable<
            Parameters<typeof window.storyStudio.agent.run>[1]
          >,
        );
        setMessages((m) => {
          const next = [...m];
          const idx = next.length - 1;
          const last = next[idx];
          if (last?.role === "assistant") {
            next[idx] = {
              role: "assistant",
              text: result.reply,
              streaming: false,
              activityLog: result.activityLog as ActivityEntry[],
              subtasks: result.subtasks,
            };
          }
          return next;
        });
        const snap = await window.storyStudio.library.openWork(workPath);
        setActiveWorkspace(snap);
        cacheManifest(workPath, snap.manifest);
        await loadConversationsFor(workPath);
        void refreshContextUsage();
      } catch (err) {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && last.streaming) {
            next.pop();
          }
          return next;
        });
        if (isAbortError(err)) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("LLM_NOT_CONFIGURED") || message.includes("LLM_API_KEY_MISSING")) {
          setLlmConfigured(false);
        }
        setComposerError(formatLlmErrorMessage(message));
      } finally {
        setLoading(false);
      }
    },
    [
      activeWorkspace?.workPath,
      activeConversationId,
      loading,
      llmReady,
      mode,
      cacheManifest,
      loadConversationsFor,
      refreshContextUsage,
      setLlmConfigured,
      applyAssistantActivity,
    ],
  );

  const startDelegate = useCallback(
    async (
      goal: string,
      workPath = activeWorkspace?.workPath,
      conversationId = activeConversationId ?? undefined,
    ) => {
      const trimmed = goal.trim();
      if (!workPath || !conversationId || !trimmed || loading || !llmReady) {
        return;
      }

      setInput("");
      setComposerError("");
      setLoading(true);
      setDelegateSession({
        status: "running",
        turn: 0,
        maxTurns: delegateMaxTurns,
        artifactPaths: [],
        goal: trimmed,
      });

      try {
        await window.storyStudio.agent.startDelegate(
          {
            workPath,
            conversationId,
            goal: trimmed,
            maxTurns: delegateMaxTurns,
          },
          applyDelegateActivity as NonNullable<
            Parameters<typeof window.storyStudio.agent.startDelegate>[1]
          >,
        );
        const snap = await window.storyStudio.library.openWork(workPath);
        setActiveWorkspace(snap);
        cacheManifest(workPath, snap.manifest);
        await loadConversationsFor(workPath);
        void refreshContextUsage();
      } catch (err) {
        setDelegateSession(null);
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && last.streaming) {
            next.pop();
          }
          return next;
        });
        if (isAbortError(err)) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("LLM_NOT_CONFIGURED") || message.includes("LLM_API_KEY_MISSING")) {
          setLlmConfigured(false);
        }
        setComposerError(formatLlmErrorMessage(message));
      } finally {
        setLoading(false);
        setDelegateSession(null);
      }
    },
    [
      activeWorkspace?.workPath,
      activeConversationId,
      loading,
      llmReady,
      delegateMaxTurns,
      cacheManifest,
      loadConversationsFor,
      refreshContextUsage,
      setLlmConfigured,
      applyDelegateActivity,
    ],
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
    [cacheManifest, expandWorkspace, loadConversationMessages],
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

  const startNewConversation = useCallback(
    async (workPath: string, initialMessage: string) => {
      const created = await window.storyStudio.library.createConversation(workPath);
      await loadConversationsFor(workPath);
      await activateConversation(workPath, created.id);
      setComposeDefaultWorkPath(undefined);

      if (initialMessage) {
        if (mode === "delegate") {
          await startDelegate(initialMessage, workPath, created.id);
        } else {
          await sendMessage(initialMessage, workPath, created.id);
        }
      }
    },
    [loadConversationsFor, activateConversation, sendMessage, startDelegate, mode],
  );

  const send = useCallback(async () => {
    if (!activeWorkspace || !activeConversationId || !input.trim()) return;
    if (mode === "delegate") {
      await startDelegate(input, activeWorkspace.workPath, activeConversationId);
      return;
    }
    await sendMessage(input, activeWorkspace.workPath, activeConversationId);
  }, [
    activeWorkspace,
    activeConversationId,
    input,
    mode,
    sendMessage,
    startDelegate,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
    void refreshLlmStatus();
  }, [refreshLlmStatus]);

  const openSettings = useCallback(() => {
    setSettingsSectionId("appearance");
    setShowSettings(true);
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
      await window.storyStudio.library.deleteConversation(workPath, conversationId);
      await loadConversationsFor(workPath);

      if (activeConversationId !== conversationId) return;

      setActiveConversationId(null);
      setMessages([]);
      setInput("");
      setComposerError("");
      clearAppSession();

      if (activeWorkspace?.workPath === workPath) {
        setComposeDefaultWorkPath(workPath);
      }
    },
    [
      activeConversationId,
      activeWorkspace?.workPath,
      loadConversationsFor,
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
        setComposerError("");
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
    messages,
    loading,
    llmConfigured: llmReady,
    showSettings,
    settingsSectionId,
    composeDefaultWorkPath,
    createWorkspaceOpen,
    setCreateWorkspaceOpen,
    composerError,
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
    openSettings,
    openQuickSettings,
    closeSettings,
    selectConversation,
    deleteConversation,
    removeWorkspace,
  };
}
