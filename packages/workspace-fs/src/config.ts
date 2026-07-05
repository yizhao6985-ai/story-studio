import { join } from "node:path";

let getUserDataRootFn: (() => string) | null = null;

export function configureWorkspaceFs(options: {
  getUserDataRoot: () => string;
}): void {
  getUserDataRootFn = options.getUserDataRoot;
}

export function getUserDataRoot(): string {
  if (getUserDataRootFn) {
    return getUserDataRootFn();
  }

  const fromEnv = process.env.STORY_STUDIO_USER_DATA?.trim();
  if (fromEnv) return fromEnv;

  return join(process.cwd(), ".story-studio-user-data");
}
