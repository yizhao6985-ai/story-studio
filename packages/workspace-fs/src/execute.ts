import {
  createWorkWorkspaceDirectory,
  createWorkWorkspaceFile,
  deleteWorkWorkspaceEntry,
  patchWorkWorkspaceFile,
  readWorkWorkspaceFile,
  renameWorkWorkspaceEntry,
  writeWorkWorkspaceFile,
} from "./files.js";
import { exploreWorkWorkspace } from "./explore.js";
import { listWorkFileTree } from "./tree.js";
import { globWorkWorkspace, grepWorkWorkspace } from "./search.js";

export async function executeWorkspaceTool(
  workPath: string,
  toolId: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (toolId) {
    case "list_workspace_tree":
      return listWorkFileTree(workPath);
    case "list_workspace_dir":
      return exploreWorkWorkspace(workPath, String(args.path ?? ""));
    case "glob_workspace":
      return globWorkWorkspace(workPath, String(args.pattern ?? ""));
    case "grep_workspace":
      return grepWorkWorkspace({
        workPath,
        query: String(args.query ?? ""),
        pathPrefix:
          typeof args.pathPrefix === "string" ? args.pathPrefix : undefined,
        useRegex: Boolean(args.useRegex),
      });
    case "read_workspace_file":
      return readWorkWorkspaceFile(workPath, String(args.path ?? ""), {
        startLine:
          typeof args.startLine === "number" ? args.startLine : undefined,
        endLine: typeof args.endLine === "number" ? args.endLine : undefined,
      });
    case "patch_workspace_file":
      return patchWorkWorkspaceFile(
        workPath,
        String(args.path ?? ""),
        String(args.oldText ?? ""),
        String(args.newText ?? ""),
      );
    case "write_workspace_file":
      await writeWorkWorkspaceFile(
        workPath,
        String(args.path ?? ""),
        String(args.content ?? ""),
      );
      return { path: args.path, bytes: String(args.content ?? "").length };
    case "create_workspace_file":
      await createWorkWorkspaceFile(
        workPath,
        String(args.path ?? ""),
        String(args.content ?? ""),
      );
      return { path: args.path };
    case "create_workspace_directory":
      await createWorkWorkspaceDirectory(workPath, String(args.path ?? ""));
      return { path: args.path };
    case "delete_workspace_entry":
      await deleteWorkWorkspaceEntry(workPath, String(args.path ?? ""));
      return { path: args.path };
    case "rename_workspace_entry":
      await renameWorkWorkspaceEntry(
        workPath,
        String(args.fromPath ?? ""),
        String(args.toPath ?? ""),
      );
      return { fromPath: args.fromPath, toPath: args.toPath };
    default:
      throw new Error(`UNKNOWN_TOOL:${toolId}`);
  }
}
