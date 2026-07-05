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
      };

      settings: {
        getLlmStatus: () => Promise<{ configured: boolean; baseUrl: string }>;
        getLlmPreferences: () => Promise<{
          configured: boolean;
          baseUrl: string;
          chatModel: string;
          chatModels: { id: string; label: string }[];
          modelsError?: string;
        }>;
        setChatModel: (modelId: string) => Promise<void>;
        saveLlm: (input: {
          apiKey: string;
          baseUrl?: string;
        }) => Promise<void>;
        updateLlm: (input: {
          apiKey?: string;
          baseUrl?: string;
        }) => Promise<void>;
        validateLlm: () => Promise<{ ok: boolean; message?: string }>;
        clearLlm: () => Promise<void>;
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
        loadConversationMessages: (
          workPath: string,
          conversationId: string,
        ) => Promise<
          Array<
            | { role: "user"; text: string }
            | { role: "delegate"; text: string; turn: number }
            | {
                role: "assistant";
                text: string;
                activityLog?: Array<{
                  id: string;
                  subtaskId?: string;
                  stage: string;
                  action: string;
                  label: string;
                  detail?: string;
                  path?: string;
                  status: string;
                }>;
                subtasks?: Array<{ id: string; intent: string; status: string }>;
              }
          >
        >;
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

      agent: {
        run: (
          input: {
            workPath: string;
            conversationId: string;
            message: string;
            mode: "ask" | "normal";
          },
          onActivity?: (event: {
            type: string;
            status?: "planning" | "thinking" | "executing" | "synthesizing";
            subtasks?: Array<{ id: string; intent: string; status: string }>;
            entry?: {
              id: string;
              subtaskId?: string;
              stage: string;
              action: string;
              label: string;
              detail?: string;
              path?: string;
              status: string;
            };
            delta?: string;
            reply?: string;
            message?: string;
            type?: string;
          }) => void,
        ) => Promise<{
          reply: string;
          activityLog: Array<{
            id: string;
            subtaskId?: string;
            stage: string;
            action: string;
            label: string;
            detail?: string;
            path?: string;
            status: string;
          }>;
          subtasks: Array<{ id: string; intent: string; status: string }>;
        }>;
        cancel: () => Promise<void>;
        getContextUsage: (input: {
          workPath: string;
          conversationId: string;
          mode: "ask" | "normal";
          draftMessage?: string;
        }) => Promise<{
          percent: number;
          usedTokens: number;
          budgetTokens: number;
          hasSummary: boolean;
          modelLabel?: string;
        }>;
        startDelegate: (
          input: {
            workPath: string;
            conversationId: string;
            goal: string;
            maxTurns?: number;
          },
          onActivity?: (event: {
            type: string;
            status?: string;
            turn?: number;
            maxTurns?: number;
            artifactPaths?: string[];
            goal?: string;
            message?: string;
            rationale?: string;
            summary?: string;
            turns?: number;
            subtasks?: Array<{ id: string; intent: string; status: string }>;
            entry?: {
              id: string;
              subtaskId?: string;
              stage: string;
              action: string;
              label: string;
              detail?: string;
              path?: string;
              status: string;
            };
            delta?: string;
            reply?: string;
          }) => void,
        ) => Promise<{
          status:
            | "completed"
            | "escalated"
            | "max_turns"
            | "paused"
            | "failed";
          summary: string;
          artifactPaths: string[];
          turns: number;
        }>;
      };
    };
  }

  namespace React {
    interface CSSProperties {
      WebkitAppRegion?: "drag" | "no-drag";
    }
  }
}
