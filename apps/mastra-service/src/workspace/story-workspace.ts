import { LocalFilesystem, Workspace } from "@mastra/core/workspace";

import { requireWorkPath } from "../platform/work-path.js";
import {
  workspaceToolsForProfile,
  type WorkspaceToolProfile,
} from "./tool-profiles.js";

export function createStoryWorkspace({
  requestContext,
  toolProfile = "read-only",
}: {
  requestContext: Parameters<typeof requireWorkPath>[0];
  toolProfile?: WorkspaceToolProfile;
}) {
  const workPath = requireWorkPath(requestContext);
  const tools = workspaceToolsForProfile(toolProfile);

  return new Workspace({
    id: "story-work",
    name: "Story Work",
    filesystem: new LocalFilesystem({
      basePath: workPath,
      readOnly: toolProfile === "read-only",
    }),
    tools,
  });
}
