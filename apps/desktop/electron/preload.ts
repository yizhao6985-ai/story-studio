import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("storyStudio", {
  platform: process.platform,

  app: {
    closeWindow: () => ipcRenderer.invoke("app:closeWindow"),
    getUserDataPath: () =>
      ipcRenderer.invoke("app:getUserDataPath") as Promise<string>,
  },

  studio: {
    getLangGraphApiUrl: () =>
      ipcRenderer.invoke("studio:getLangGraphApiUrl") as Promise<string | null>,
    getServiceStatus: () =>
      ipcRenderer.invoke("studio:getServiceStatus") as Promise<{
        mcp: { ok: boolean; url: string };
        langgraph: { ok: boolean; url: string | null; embedded: boolean };
      }>,
    waitForServices: () =>
      ipcRenderer.invoke("studio:waitForServices") as Promise<{
        mcp: { ok: boolean; url: string };
        langgraph: { ok: boolean; url: string | null; embedded: boolean };
      }>,
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
