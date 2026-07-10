import { join } from "node:path";

import { configureWorkspaceFs } from "@story-studio/workspace-fs";

export type RuntimeConfig = {
  userDataRoot: string;
};

let runtimeConfig: RuntimeConfig | null = null;

function resolveUserDataRoot(): string {
  if (runtimeConfig?.userDataRoot) return runtimeConfig.userDataRoot;

  const fromEnv = process.env.STORY_STUDIO_USER_DATA?.trim();
  if (fromEnv) return fromEnv;

  return join(process.cwd(), ".story-studio-user-data");
}

configureWorkspaceFs({ getUserDataRoot: resolveUserDataRoot });

export function setRuntimeConfig(config: RuntimeConfig): void {
  runtimeConfig = {
    userDataRoot: config.userDataRoot.trim(),
  };
}

export function getRuntimeConfig(): RuntimeConfig | null {
  return runtimeConfig;
}
