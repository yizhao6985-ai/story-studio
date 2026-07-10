import {
  WORKSPACE_TOOLS,
  type WorkspaceToolsConfig,
} from "@mastra/core/workspace";

const ALL_WORKSPACE_TOOL_IDS = [
  ...Object.values(WORKSPACE_TOOLS.FILESYSTEM),
  ...Object.values(WORKSPACE_TOOLS.SEARCH),
  ...Object.values(WORKSPACE_TOOLS.SANDBOX),
  ...Object.values(WORKSPACE_TOOLS.LSP),
];

function disableAll(): WorkspaceToolsConfig {
  return Object.fromEntries(
    ALL_WORKSPACE_TOOL_IDS.map((id) => [id, { enabled: false }]),
  ) as WorkspaceToolsConfig;
}

function withEnabled(
  base: WorkspaceToolsConfig,
  ids: string[],
): WorkspaceToolsConfig {
  const next = { ...base } as Record<string, { enabled: boolean }>;
  for (const id of ids) {
    next[id] = { enabled: true };
  }
  return next as WorkspaceToolsConfig;
}

const READ_TOOLS = [
  WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES,
  WORKSPACE_TOOLS.FILESYSTEM.GREP,
  WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
  WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT,
];

export type WorkspaceToolProfile =
  | "none"
  | "read-only"
  | "editor"
  | "writer";

export function workspaceToolsForProfile(
  profile: WorkspaceToolProfile,
): WorkspaceToolsConfig | undefined {
  switch (profile) {
    case "none":
      return disableAll();
    case "read-only":
      return withEnabled(disableAll(), READ_TOOLS);
    case "editor":
      return withEnabled(withEnabled(disableAll(), READ_TOOLS), [
        WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
      ]);
    case "writer":
      return withEnabled(withEnabled(disableAll(), READ_TOOLS), [
        WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
        WORKSPACE_TOOLS.FILESYSTEM.MKDIR,
      ]);
    default:
      return undefined;
  }
}
