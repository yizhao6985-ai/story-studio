import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  configureWorkspaceFs,
  createWorkWorkspaceDirectory,
  createWorkWorkspaceFile,
  deleteWorkWorkspaceEntry,
  listWorkFileTree,
  readWorkWorkspaceFile,
  renameWorkWorkspaceEntry,
  writeWorkWorkspaceFile,
} from "@story-studio/workspace-fs";

import {
  initWorkspaceAtPath,
  isWorkspace,
  loadWork,
  updateWorkTitle,
} from "./library/index.js";
import {
  createConversation,
  deleteConversation,
  listConversations,
  touchConversation,
} from "./library/conversation-store.js";
import { removeWorkUserData } from "./library/work-data-dir.js";
import {
  addRegisteredWork,
  listRegisteredWorks,
  removeRegisteredWork,
} from "./library/registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Keep in sync with --app-chrome-height in src/index.css */
const APP_CHROME_HEIGHT = 40;
/** macOS traffic light diameter used for vertical centering */
const MAC_TRAFFIC_LIGHT_SIZE = 12;
/**
 * hiddenInset adds a fixed downward shift; subtract a couple px so lights
 * align with flex-centered titlebar controls (h-7 / 28px).
 */
const MAC_TRAFFIC_LIGHT_Y =
  Math.round((APP_CHROME_HEIGHT - MAC_TRAFFIC_LIGHT_SIZE) / 2) - 2;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: "Story Studio",
    transparent: true,
    backgroundColor: "#00000000",
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hiddenInset",
          trafficLightPosition: { x: 14, y: MAC_TRAFFIC_LIGHT_Y },
          vibrancy: "under-window",
          visualEffectState: "active",
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  configureWorkspaceFs({ getUserDataRoot: () => app.getPath("userData") });
  createWindow();
  registerIpcHandlers();
});

function registerIpcHandlers() {
  ipcMain.handle("app:closeWindow", () => {
    mainWindow?.close();
  });

  ipcMain.handle("app:getUserDataPath", () => app.getPath("userData"));

  ipcMain.handle("library:pickDirectory", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "createDirectory"],
      title: "选择工作目录",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0]!;
  });

  ipcMain.handle(
    "library:createWorkspace",
    async (_e, directoryPath: string, title: string) => {
      const exists = await isWorkspace(directoryPath);
      const workPath = exists
        ? directoryPath
        : await initWorkspaceAtPath(directoryPath, title);
      if (exists && title.trim()) {
        await updateWorkTitle(workPath, title);
      }
      return loadWork(workPath);
    },
  );

  ipcMain.handle("library:openWork", async (_e, workPath: string) => {
    return loadWork(workPath);
  });

  ipcMain.handle("library:listWorks", () => listRegisteredWorks());

  ipcMain.handle("library:addWork", async (_e, workPath: string) => {
    return addRegisteredWork(workPath);
  });

  ipcMain.handle("library:removeWork", async (_e, workPath: string) => {
    await removeWorkUserData(workPath);
    return removeRegisteredWork(workPath);
  });

  ipcMain.handle("library:listConversations", async (_e, workPath: string) => {
    return listConversations(workPath);
  });

  ipcMain.handle(
    "library:createConversation",
    async (_e, workPath: string, title?: string) => {
      return createConversation(workPath, title);
    },
  );

  ipcMain.handle(
    "library:deleteConversation",
    async (_e, workPath: string, conversationId: string) => {
      return deleteConversation(workPath, conversationId);
    },
  );

  ipcMain.handle(
    "library:touchConversation",
    async (_e, workPath: string, conversationId: string) => {
      return touchConversation(workPath, conversationId);
    },
  );

  ipcMain.handle("library:listWorkFileTree", async (_e, workPath: string) => {
    return listWorkFileTree(workPath);
  });

  ipcMain.handle(
    "library:readWorkspaceFile",
    async (_e, workPath: string, relativePath: string) => {
      return readWorkWorkspaceFile(workPath, relativePath);
    },
  );

  ipcMain.handle(
    "library:saveWorkspaceFile",
    async (_e, workPath: string, relativePath: string, content: string) => {
      await writeWorkWorkspaceFile(workPath, relativePath, content);
      return loadWork(workPath);
    },
  );

  ipcMain.handle(
    "library:createWorkspaceFile",
    async (_e, workPath: string, relativePath: string, content?: string) => {
      await createWorkWorkspaceFile(workPath, relativePath, content ?? "");
      return loadWork(workPath);
    },
  );

  ipcMain.handle(
    "library:createWorkspaceDirectory",
    async (_e, workPath: string, relativePath: string) => {
      await createWorkWorkspaceDirectory(workPath, relativePath);
      return loadWork(workPath);
    },
  );

  ipcMain.handle(
    "library:deleteWorkspaceEntry",
    async (_e, workPath: string, relativePath: string) => {
      await deleteWorkWorkspaceEntry(workPath, relativePath);
      return loadWork(workPath);
    },
  );

  ipcMain.handle(
    "library:renameWorkspaceEntry",
    async (_e, workPath: string, fromPath: string, toPath: string) => {
      await renameWorkWorkspaceEntry(workPath, fromPath, toPath);
      return loadWork(workPath);
    },
  );
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
