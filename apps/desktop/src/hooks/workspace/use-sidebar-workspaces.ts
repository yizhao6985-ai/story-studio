import { useAsyncEffect } from "ahooks";
import { useCallback, useMemo, useState } from "react";
import type { WorkManifest, WorkSnapshot } from "@/lib/story";

import type { WorkspaceEntry } from "@/hooks/types";

function buildWorkspaceEntries(
  sidebarPaths: string[],
  manifestByPath: Record<string, WorkManifest>,
  activeWorkspace: WorkSnapshot | null,
): WorkspaceEntry[] {
  const entries: WorkspaceEntry[] = [];

  for (const workPath of sidebarPaths) {
    const manifest =
      manifestByPath[workPath] ??
      (activeWorkspace?.workPath === workPath ? activeWorkspace.manifest : null);
    if (manifest) {
      entries.push({ manifest, workPath });
      continue;
    }

    entries.push({
      manifest: {
        title: "工作空间",
      },
      workPath,
    });
  }

  return entries;
}

export function useSidebarWorkspaces(activeWorkspace: WorkSnapshot | null) {
  const [sidebarWorkspacePaths, setSidebarWorkspacePaths] = useState<string[]>([]);
  const [manifestByPath, setManifestByPath] = useState<Record<string, WorkManifest>>({});
  const [expandedWorkPaths, setExpandedWorkPaths] = useState<Set<string>>(() => new Set());
  const [workspaceRegistryLoaded, setWorkspaceRegistryLoaded] = useState(false);

  useAsyncEffect(async () => {
    const paths = await window.storyStudio.library.listWorks();
    setWorkspaceRegistryLoaded(true);
    setSidebarWorkspacePaths(paths);
  }, []);

  useAsyncEffect(async () => {
    if (!workspaceRegistryLoaded) return;

    const paths = sidebarWorkspacePaths;
    if (paths.length === 0) return;

    const loaded = await Promise.all(
      paths.map(async (workPath) => {
        try {
          const snap = await window.storyStudio.library.openWork(workPath);
          return [workPath, snap.manifest] as const;
        } catch {
          return null;
        }
      }),
    );

    setManifestByPath((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of loaded) {
        if (!item) continue;
        const [workPath, manifest] = item;
        if (next[workPath]?.title !== manifest.title || !(workPath in next)) {
          next[workPath] = manifest;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sidebarWorkspacePaths, workspaceRegistryLoaded]);

  const workspaceEntries = useMemo(
    () =>
      buildWorkspaceEntries(
        sidebarWorkspacePaths,
        manifestByPath,
        activeWorkspace,
      ),
    [sidebarWorkspacePaths, manifestByPath, activeWorkspace],
  );

  const addWorkspaceToSidebar = useCallback(async (workPath: string) => {
    const paths = await window.storyStudio.library.addWork(workPath);
    setSidebarWorkspacePaths(paths);
  }, []);

  const expandWorkspace = useCallback((workPath: string) => {
    setExpandedWorkPaths((prev) => new Set(prev).add(workPath));
  }, []);

  const toggleWorkspace = useCallback((workPath: string) => {
    setExpandedWorkPaths((prev) => {
      const next = new Set(prev);
      if (next.has(workPath)) next.delete(workPath);
      else next.add(workPath);
      return next;
    });
  }, []);

  const removeWorkspaceFromSidebar = useCallback(async (workPath: string) => {
    const paths = await window.storyStudio.library.removeWork(workPath);
    setSidebarWorkspacePaths(paths);
    setExpandedWorkPaths((prev) => {
      const next = new Set(prev);
      next.delete(workPath);
      return next;
    });
    setManifestByPath((prev) => {
      if (!(workPath in prev)) return prev;
      const next = { ...prev };
      delete next[workPath];
      return next;
    });
  }, []);

  const cacheManifest = useCallback((workPath: string, manifest: WorkManifest) => {
    setManifestByPath((prev) => ({ ...prev, [workPath]: manifest }));
  }, []);

  return {
    sidebarWorkspacePaths,
    workspaceRegistryLoaded,
    manifestByPath,
    setManifestByPath,
    expandedWorkPaths,
    workspaceEntries,
    addWorkspaceToSidebar,
    expandWorkspace,
    toggleWorkspace,
    removeWorkspaceFromSidebar,
    cacheManifest,
  };
}
