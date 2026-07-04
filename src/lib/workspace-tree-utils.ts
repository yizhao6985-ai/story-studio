import type { WorkspaceEntry } from "@/lib/story";
import { README_FILE } from "@/lib/story/constants";

export function findWorkspaceEntry(
  entries: WorkspaceEntry[],
  path: string,
): WorkspaceEntry | null {
  for (const entry of entries) {
    if (entry.path === path) return entry;
    if (entry.children?.length) {
      const nested = findWorkspaceEntry(entry.children, path);
      if (nested) return nested;
    }
  }
  return null;
}

export function collectPaths(entries: WorkspaceEntry[]): string[] {
  const paths: string[] = [];
  for (const entry of entries) {
    paths.push(entry.path);
    if (entry.children?.length) paths.push(...collectPaths(entry.children));
  }
  return paths;
}

export function pickDefaultFile(entries: WorkspaceEntry[]): string | null {
  if (findWorkspaceEntry(entries, README_FILE)?.kind === "file") {
    return README_FILE;
  }

  return (
    collectPaths(entries).find((path) => {
      const entry = findWorkspaceEntry(entries, path);
      return entry?.kind === "file" && path.endsWith(".md");
    }) ?? null
  );
}
