import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createWorkWorkspaceDirectory,
  createWorkWorkspaceFile,
  deleteWorkWorkspaceEntry,
  initWorkspaceAtPath,
  isWorkspace,
  listWorkFileTree,
  loadWork,
  readWorkWorkspaceFile,
  renameWorkWorkspaceEntry,
  updateWorkTitle,
  writeWorkWorkspaceFile,
} from "./library/index.js";
import {
  createConversation,
  deleteConversation,
  listConversations,
} from "./library/conversation-store.js";

import {
  cancelLocalAgent,
  getAgentContextUsage,
  loadConversationMessages,
  runLocalAgent,
} from "./agent/runtime/runner.js";
import {
  cancelDelegateSession,
  runDelegateSession,
} from "./agent/runtime/delegate/session.js";
import { releaseWorkAgent } from "./agent/runtime/work-graph.js";
import { removeWorkUserData } from "./library/work-data-dir.js";
import {
  addRegisteredWork,
  listRegisteredWorks,
  removeRegisteredWork,
} from "./library/registry.js";
import {
  clearLlmSettings,
  getLlmPreferences,
  getLlmSettingsStatus,
  isLlmConfigured,
  saveLlmSettings,
  setChatModel,
  updateLlmSettings,
  validateLlmSettings,
} from "./settings/store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Keep in sync with --app-chrome-height in apps/desktop/src/index.css */
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
          // Keep in sync with --mac-traffic-light-* in apps/desktop/src/index.css
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

app.whenReady().then(() => {
  createWindow();
  registerIpcHandlers();
});

function registerIpcHandlers() {
  ipcMain.handle("app:closeWindow", () => {
    mainWindow?.close();
  });

  // --- Settings: LLM 配置（使用 Agent 前） ---
  ipcMain.handle("settings:getLlmStatus", () => getLlmSettingsStatus());

  ipcMain.handle("settings:getLlmPreferences", () => getLlmPreferences());

  ipcMain.handle("settings:setChatModel", async (_e, modelId: string) => {
    await setChatModel(modelId);
  });

  ipcMain.handle(
    "settings:saveLlm",
    async (_e, input: { apiKey: string; baseUrl?: string }) => {
      await saveLlmSettings(input);
    },
  );

  ipcMain.handle(
    "settings:updateLlm",
    async (_e, input: { apiKey?: string; baseUrl?: string }) => {
      await updateLlmSettings(input);
    },
  );

  ipcMain.handle("settings:validateLlm", async () => validateLlmSettings());

  ipcMain.handle("settings:clearLlm", async () => {
    clearLlmSettings();
  });

  // --- Library: 工作空间生命周期 ---
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
    releaseWorkAgent(workPath);
    await removeWorkUserData(workPath);
    return removeRegisteredWork(workPath);
  });

  // --- Library: 对话 ---
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
    "library:loadConversationMessages",
    async (_e, workPath: string, conversationId: string) => {
      return loadConversationMessages({ workPath, conversationId });
    },
  );

  // --- Agent: 本地对话 ---
  ipcMain.handle("agent:run", async (event, input) => {
    if (!isLlmConfigured()) {
      throw new Error("LLM_NOT_CONFIGURED");
    }
    const typed = input as Parameters<typeof runLocalAgent>[0] & {
      activityChannel?: string;
    };
    const { activityChannel, ...runInput } = typed;
    return runLocalAgent({
      ...runInput,
      onActivity: activityChannel
        ? (activity) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(activityChannel, activity);
            }
          }
        : undefined,
    });
  });

  ipcMain.handle("agent:cancel", () => {
    cancelDelegateSession();
    cancelLocalAgent();
  });

  ipcMain.handle("agent:startDelegate", async (event, input) => {
    if (!isLlmConfigured()) {
      throw new Error("LLM_NOT_CONFIGURED");
    }
    const typed = input as Parameters<typeof runDelegateSession>[0] & {
      activityChannel?: string;
    };
    const { activityChannel, ...runInput } = typed;
    return runDelegateSession({
      ...runInput,
      onActivity: activityChannel
        ? (activity) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(activityChannel, activity);
            }
          }
        : undefined,
    });
  });

  ipcMain.handle("agent:getContextUsage", async (_e, input) => {
    return getAgentContextUsage(input as Parameters<typeof getAgentContextUsage>[0]);
  });

  // --- Library: 作品文件树 ---
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
