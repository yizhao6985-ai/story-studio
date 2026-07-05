import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("storyStudio", {
  platform: process.platform,

  app: {
    closeWindow: () => ipcRenderer.invoke("app:closeWindow"),
    getUserDataPath: () =>
      ipcRenderer.invoke("app:getUserDataPath") as Promise<string>,
  },

  library: {
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
    touchConversation: (workPath: string, conversationId: string) =>
      ipcRenderer.invoke(
        "library:touchConversation",
        workPath,
        conversationId,
      ),
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
});
