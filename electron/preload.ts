import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("storyStudio", {
  platform: process.platform,

  app: {
    closeWindow: () => ipcRenderer.invoke("app:closeWindow"),
  },

  // --- Settings: LLM 配置 ---
  settings: {
    getLlmStatus: () => ipcRenderer.invoke("settings:getLlmStatus"),
    getLlmPreferences: () => ipcRenderer.invoke("settings:getLlmPreferences"),
    setChatModel: (modelId: string) =>
      ipcRenderer.invoke("settings:setChatModel", modelId),
    saveLlm: (input: { apiKey: string; baseUrl?: string }) =>
      ipcRenderer.invoke("settings:saveLlm", input),
    updateLlm: (input: { apiKey?: string; baseUrl?: string }) =>
      ipcRenderer.invoke("settings:updateLlm", input),
    validateLlm: () => ipcRenderer.invoke("settings:validateLlm"),
    clearLlm: () => ipcRenderer.invoke("settings:clearLlm"),
  },

  // --- Library: 工作空间与文件 ---
  library: {
    // 生命周期
    pickDirectory: () => ipcRenderer.invoke("library:pickDirectory"),
    createWorkspace: (directoryPath: string, title: string) =>
      ipcRenderer.invoke("library:createWorkspace", directoryPath, title),
    openWork: (workPath: string) =>
      ipcRenderer.invoke("library:openWork", workPath),
    listWorks: () => ipcRenderer.invoke("library:listWorks"),
    addWork: (workPath: string) =>
      ipcRenderer.invoke("library:addWork", workPath),
    removeWork: (workPath: string) =>
      ipcRenderer.invoke("library:removeWork", workPath),
    // 对话
    listConversations: (workPath: string) =>
      ipcRenderer.invoke("library:listConversations", workPath),
    createConversation: (workPath: string, title?: string) =>
      ipcRenderer.invoke("library:createConversation", workPath, title),
    deleteConversation: (workPath: string, conversationId: string) =>
      ipcRenderer.invoke(
        "library:deleteConversation",
        workPath,
        conversationId,
      ),
    loadConversationMessages: (workPath: string, conversationId: string) =>
      ipcRenderer.invoke(
        "library:loadConversationMessages",
        workPath,
        conversationId,
      ),
    // 方案（Scheme）
    getDiff: (workPath: string) =>
      ipcRenderer.invoke("library:getDiff", workPath),
    confirmScheme: (workPath: string) =>
      ipcRenderer.invoke("library:confirmScheme", workPath),
    discardScheme: (workPath: string) =>
      ipcRenderer.invoke("library:discardScheme", workPath),
    // 作品文件树
    listWorkFileTree: (workPath: string) =>
      ipcRenderer.invoke("library:listWorkFileTree", workPath),
    readWorkspaceFile: (workPath: string, relativePath: string) =>
      ipcRenderer.invoke("library:readWorkspaceFile", workPath, relativePath),
    saveWorkspaceFile: (
      workPath: string,
      relativePath: string,
      content: string,
    ) =>
      ipcRenderer.invoke(
        "library:saveWorkspaceFile",
        workPath,
        relativePath,
        content,
      ),
    createWorkspaceFile: (
      workPath: string,
      relativePath: string,
      content?: string,
    ) =>
      ipcRenderer.invoke(
        "library:createWorkspaceFile",
        workPath,
        relativePath,
        content,
      ),
    createWorkspaceDirectory: (workPath: string, relativePath: string) =>
      ipcRenderer.invoke(
        "library:createWorkspaceDirectory",
        workPath,
        relativePath,
      ),
    deleteWorkspaceEntry: (workPath: string, relativePath: string) =>
      ipcRenderer.invoke(
        "library:deleteWorkspaceEntry",
        workPath,
        relativePath,
      ),
    renameWorkspaceEntry: (
      workPath: string,
      fromPath: string,
      toPath: string,
    ) =>
      ipcRenderer.invoke(
        "library:renameWorkspaceEntry",
        workPath,
        fromPath,
        toPath,
      ),
  },

  // --- Agent: 本地对话 ---
  agent: {
    run: (
      input: Record<string, unknown>,
      onActivity?: (event: unknown) => void,
    ) => {
      const activityChannel = onActivity
        ? `agent:activity:${crypto.randomUUID()}`
        : undefined;
      const handler = (_event: Electron.IpcRendererEvent, event: unknown) => {
        onActivity?.(event);
      };
      if (activityChannel && onActivity) {
        ipcRenderer.on(activityChannel, handler);
      }
      return ipcRenderer
        .invoke("agent:run", { ...input, activityChannel })
        .finally(() => {
          if (activityChannel) {
            ipcRenderer.removeListener(activityChannel, handler);
          }
        });
    },
    cancel: () => ipcRenderer.invoke("agent:cancel"),
    getContextUsage: (input: {
      workPath: string;
      conversationId: string;
      mode: "ask" | "normal" | "scheme";
      draftMessage?: string;
    }) => ipcRenderer.invoke("agent:getContextUsage", input),
    startDelegate: (
      input: {
        workPath: string;
        conversationId: string;
        goal: string;
        maxTurns?: number;
      },
      onActivity?: (event: unknown) => void,
    ) => {
      const activityChannel = onActivity
        ? `agent:activity:${crypto.randomUUID()}`
        : undefined;
      const handler = (_event: Electron.IpcRendererEvent, event: unknown) => {
        onActivity?.(event);
      };
      if (activityChannel && onActivity) {
        ipcRenderer.on(activityChannel, handler);
      }
      return ipcRenderer
        .invoke("agent:startDelegate", { ...input, activityChannel })
        .finally(() => {
          if (activityChannel) {
            ipcRenderer.removeListener(activityChannel, handler);
          }
        });
    },
  },
});
