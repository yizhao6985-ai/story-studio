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
        listConversations: (workPath: string) => Promise<ConversationManifest[]>;
        createConversation: (
          workPath: string,
          title?: string,
        ) => Promise<ConversationManifest>;
        deleteConversation: (
          workPath: string,
          conversationId: string,
        ) => Promise<boolean>;
        touchConversation: (
          workPath: string,
          conversationId: string,
        ) => Promise<ConversationManifest | null>;
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
