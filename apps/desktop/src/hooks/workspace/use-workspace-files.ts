import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkSnapshot, WorkspaceEntry } from "@/lib/story";

import {
  collectPaths,
  findWorkspaceEntry,
  pickDefaultFile,
} from "@/lib/workspace-tree-utils";

type TabState = {
  content: string;
  savedContent: string;
  readable: boolean;
};

type UseWorkspaceFilesOptions = {
  work: WorkSnapshot | null;
  refreshKey: string;
  onWorkUpdated?: (work: WorkSnapshot) => void;
};

function isTabDirty(state: TabState | undefined): boolean {
  return state ? state.content !== state.savedContent : false;
}

export function useWorkspaceFiles({ work, refreshKey, onWorkUpdated }: UseWorkspaceFilesOptions) {
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [tabStates, setTabStates] = useState<Record<string, TabState>>({});
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const loadedWorkPathRef = useRef<string | null>(null);
  const tabStatesRef = useRef(tabStates);
  const openTabsRef = useRef(openTabs);

  useEffect(() => {
    tabStatesRef.current = tabStates;
  }, [tabStates]);

  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);

  const loadFileIntoTab = useCallback(async (workPath: string, path: string) => {
    setLoadingPath(path);
    try {
      const file = await window.storyStudio.library.readWorkspaceFile(workPath, path);
      setTabStates((prev) => ({
        ...prev,
        [path]: {
          content: file.content,
          savedContent: file.content,
          readable: file.readable,
        },
      }));
      setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setActivePath(path);
    } finally {
      setLoadingPath(null);
    }
  }, []);

  const loadTree = useCallback(async () => {
    if (!work) return [] as WorkspaceEntry[];
    setLoadingTree(true);
    try {
      const tree = await window.storyStudio.library.listWorkFileTree(work.workPath);
      setEntries(tree);
      return tree;
    } finally {
      setLoadingTree(false);
    }
  }, [work]);

  const knownFilePaths = useCallback((tree: WorkspaceEntry[]) => {
    return collectPaths(tree).filter(
      (path) => findWorkspaceEntry(tree, path)?.kind === "file",
    );
  }, []);

  const pruneInvalidTabs = useCallback((tree: WorkspaceEntry[]) => {
    const validPaths = new Set(knownFilePaths(tree));

    setOpenTabs((prev) => prev.filter((path) => validPaths.has(path)));
    setTabStates((prev) => {
      const next: Record<string, TabState> = {};
      for (const [path, state] of Object.entries(prev)) {
        if (validPaths.has(path)) next[path] = state;
      }
      return next;
    });

    setActivePath((current) => {
      if (current && validPaths.has(current)) return current;
      const remaining = openTabsRef.current.filter((path) => validPaths.has(path));
      return remaining[remaining.length - 1] ?? null;
    });
  }, [knownFilePaths]);

  const reloadCleanTabs = useCallback(
    async (workPath: string, tree: WorkspaceEntry[], force = false) => {
      const validPaths = new Set(knownFilePaths(tree));

      await Promise.all(
        openTabsRef.current.map(async (path) => {
          if (!validPaths.has(path)) return;
          const state = tabStatesRef.current[path];
          if (!state || (!force && isTabDirty(state))) return;

          const file = await window.storyStudio.library.readWorkspaceFile(workPath, path);
          setTabStates((prev) => ({
            ...prev,
            [path]: {
              content: file.content,
              savedContent: file.content,
              readable: file.readable,
            },
          }));
        }),
      );
    },
    [knownFilePaths],
  );

  const openInitialFile = useCallback(
    async (tree: WorkspaceEntry[]) => {
      if (!work) return;
      const defaultPath = pickDefaultFile(tree);
      if (defaultPath) {
        await loadFileIntoTab(work.workPath, defaultPath);
      } else {
        setOpenTabs([]);
        setActivePath(null);
        setTabStates({});
      }
    },
    [work, loadFileIntoTab],
  );

  const syncOpenTabs = useCallback(
    async (tree: WorkspaceEntry[], options: { reset?: boolean; force?: boolean } = {}) => {
      if (!work) return;

      if (options.reset) {
        setOpenTabs([]);
        setActivePath(null);
        setTabStates({});
        await openInitialFile(tree);
        return;
      }

      pruneInvalidTabs(tree);
      await reloadCleanTabs(work.workPath, tree, options.force);

      if (openTabsRef.current.length === 0) {
        await openInitialFile(tree);
      }
    },
    [work, openInitialFile, pruneInvalidTabs, reloadCleanTabs],
  );

  const refreshWorkspace = useCallback(
    async (reset = false, force = false) => {
      if (!work) return;
      const tree = await loadTree();
      await syncOpenTabs(tree, { reset, force });
    },
    [work, loadTree, syncOpenTabs],
  );

  useEffect(() => {
    if (!work) {
      loadedWorkPathRef.current = null;
      setEntries([]);
      setOpenTabs([]);
      setActivePath(null);
      setTabStates({});
      return;
    }

    const switchedWorkspace = loadedWorkPathRef.current !== work.workPath;
    loadedWorkPathRef.current = work.workPath;

    if (switchedWorkspace) {
      void refreshWorkspace(true, true);
      return;
    }

    void (async () => {
      const tree = await loadTree();
      await syncOpenTabs(tree, { force: false });
    })();
  }, [work?.workPath, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWorkspaceMutated = useCallback(async () => {
    if (!work) return;
    const updated = await window.storyStudio.library.openWork(work.workPath);
    onWorkUpdated?.(updated);
    await refreshWorkspace(false, true);
  }, [onWorkUpdated, refreshWorkspace, work]);

  const handleSave = useCallback(async () => {
    if (!work || !activePath) return;
    const state = tabStates[activePath];
    if (!state?.readable) return;

    setSaving(true);
    try {
      const updated = await window.storyStudio.library.saveWorkspaceFile(
        work.workPath,
        activePath,
        state.content,
      );
      setTabStates((prev) => ({
        ...prev,
        [activePath]: {
          ...prev[activePath]!,
          savedContent: state.content,
        },
      }));
      onWorkUpdated?.(updated);
    } finally {
      setSaving(false);
    }
  }, [work, activePath, tabStates, onWorkUpdated]);

  const selectFile = useCallback(
    (path: string) => {
      if (!work) return;
      if (tabStates[path]) {
        setActivePath(path);
        return;
      }
      void loadFileIntoTab(work.workPath, path);
    },
    [work, tabStates, loadFileIntoTab],
  );

  const selectTab = useCallback((path: string) => {
    if (tabStates[path]) {
      setActivePath(path);
    }
  }, [tabStates]);

  const closeTab = useCallback(
    (path: string) => {
      if (isTabDirty(tabStates[path])) return;

      const nextTabs = openTabs.filter((tabPath) => tabPath !== path);
      setOpenTabs(nextTabs);
      setTabStates((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });

      if (activePath === path) {
        setActivePath(nextTabs[nextTabs.length - 1] ?? null);
      }
    },
    [openTabs, activePath, tabStates],
  );

  const closeCurrentOrApp = useCallback(() => {
    if (openTabs.length > 0) {
      if (activePath && !isTabDirty(tabStates[activePath])) {
        closeTab(activePath);
      }
      return;
    }

    void window.storyStudio.app.closeWindow();
  }, [openTabs, activePath, tabStates, closeTab]);

  const setFileContent = useCallback(
    (value: string) => {
      if (!activePath) return;
      setTabStates((prev) => {
        const current = prev[activePath];
        if (!current) return prev;
        return {
          ...prev,
          [activePath]: { ...current, content: value },
        };
      });
    },
    [activePath],
  );

  const activeState = activePath ? tabStates[activePath] : undefined;

  return {
    entries,
    openTabs: openTabs.map((path) => ({
      path,
      dirty: isTabDirty(tabStates[path]),
    })),
    selectedPath: activePath,
    fileContent: activeState?.content ?? "",
    savedContent: activeState?.savedContent ?? "",
    readable: activeState?.readable ?? true,
    loadingTree,
    loadingFile: loadingPath !== null && loadingPath === activePath,
    saving,
    setFileContent,
    selectFile,
    selectTab,
    closeTab,
    closeCurrentOrApp,
    refreshWorkspace,
    handleWorkspaceMutated,
    handleSave,
  };
}
