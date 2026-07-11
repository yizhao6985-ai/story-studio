import type {
  ConversationManifest,
  WorkManifest,
  WorkSnapshot,
  WorkspaceEntry,
} from "@/lib/story";

export {};

declare global {
  interface Window {
    storyStudio: {
      platform: NodeJS.Platform;

      app: {
        closeWindow: () => Promise<void>;
        getUserDataPath: () => Promise<string>;
      };

      studio: {
        getLangGraphApiUrl: () => Promise<string | null>;
        getServiceStatus: () => Promise<{
          mcp: { ok: boolean; url: string };
          langgraph: { ok: boolean; url: string | null; embedded: boolean };
        }>;
        waitForServices: () => Promise<{
          mcp: { ok: boolean; url: string };
          langgraph: { ok: boolean; url: string | null; embedded: boolean };
        }>;
      };

      library: {
        pickDirectory: () => Promise<string | null>;
        createWorkspace: (
          directoryPath: string,
          title: string,
        ) => Promise<WorkSnapshot>;
        openWork: (workPath: string) => Promise<WorkSnapshot>;
        listWorks: () => Promise<string[]>;
        addWork: (workPath: string) => Promise<string[]>;
        removeWork: (workPath: string) => Promise<string[]>;
        listWorkFileTree: (workPath: string) => Promise<WorkspaceEntry[]>;
        readWorkspaceFile: (
          workPath: string,
          relativePath: string,
        ) => Promise<{ path: string; content: string; readable: boolean }>;
        saveWorkspaceFile: (
          workPath: string,
          relativePath: string,
          content: string,
        ) => Promise<WorkSnapshot>;
        createWorkspaceFile: (
          workPath: string,
          relativePath: string,
          content?: string,
        ) => Promise<WorkSnapshot>;
        createWorkspaceDirectory: (
          workPath: string,
          relativePath: string,
        ) => Promise<WorkSnapshot>;
        deleteWorkspaceEntry: (
          workPath: string,
          relativePath: string,
        ) => Promise<WorkSnapshot>;
        renameWorkspaceEntry: (
          workPath: string,
          fromPath: string,
          toPath: string,
        ) => Promise<WorkSnapshot>;
      };
    };
  }

  namespace React {
    interface CSSProperties {
      WebkitAppRegion?: "drag" | "no-drag";
    }
  }
}
