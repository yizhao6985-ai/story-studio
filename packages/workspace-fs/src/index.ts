export { configureWorkspaceFs, getUserDataRoot } from "./config.js";
export { README_FILE } from "./constants.js";
export { isProtectedWorkspacePath } from "./protected-paths.js";
export { initGitRepo } from "./git.js";
export {
  bumpWorkManifest,
  bumpWorkRevision,
  readWorkUserMeta,
  setWorkDisplayTitle,
  type WorkUserMeta,
} from "./work-meta.js";
export {
  assertParentDirectorySegments,
  assertWorkspaceDirectoryName,
  assertWorkspaceDirectorySegments,
  assertWorkspaceEntryName,
  isTextFile,
  resolveWorkspaceFilePath,
  TEXT_EXTENSIONS,
} from "./paths.js";
export { listWorkFileTree, pickDefaultWorkspaceFile } from "./tree.js";
export { exploreWorkWorkspace, type ExploreEntry } from "./explore.js";
export {
  globWorkWorkspace,
  grepWorkWorkspace,
  type GrepMatch,
} from "./search.js";
export {
  createWorkWorkspaceDirectory,
  createWorkWorkspaceFile,
  deleteWorkWorkspaceEntry,
  hashWorkspaceContent,
  patchWorkWorkspaceFile,
  readWorkWorkspaceFile,
  renameWorkWorkspaceEntry,
  workspaceFileExists,
  writeWorkWorkspaceFile,
} from "./files.js";
export { updateConversationTitle } from "./conversations.js";
export { executeWorkspaceTool } from "./execute.js";
