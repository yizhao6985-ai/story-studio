import { useCallback, useRef, useState } from "react";
import { useGroupRef, usePanelRef } from "react-resizable-panels";

import {
  COLLAPSED_WORKSPACE_FILES_LAYOUT,
  DEFAULT_WORKSPACE_FILES_LAYOUT,
} from "@/lib/panel-layout";

function isFileTreeCollapsed(layout: Record<string, number>) {
  return (layout["file-tree"] ?? 0) < 0.5;
}

export function useFileTreePanelCollapse() {
  const filesGroupRef = useGroupRef();
  const fileTreePanelRef = usePanelRef();
  const savedLayoutRef = useRef<Record<string, number> | null>(null);
  const programmaticCollapseRef = useRef(false);

  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false);

  const recordVisibleFilesLayout = useCallback((layout: Record<string, number>) => {
    if (isFileTreeCollapsed(layout)) {
      if (programmaticCollapseRef.current) {
        programmaticCollapseRef.current = false;
        setFileTreeCollapsed(true);
        return;
      }

      const group = filesGroupRef.current;
      const panel = fileTreePanelRef.current;
      const restore = savedLayoutRef.current ?? {
        "file-tree": DEFAULT_WORKSPACE_FILES_LAYOUT["file-tree"],
        editor: DEFAULT_WORKSPACE_FILES_LAYOUT.editor,
      };
      queueMicrotask(() => {
        group?.setLayout(restore);
        panel?.expand();
      });
      setFileTreeCollapsed(false);
      return;
    }

    savedLayoutRef.current = { ...layout };
    setFileTreeCollapsed(false);
  }, [filesGroupRef, fileTreePanelRef]);

  const toggleFileTreePanel = useCallback(() => {
    const group = filesGroupRef.current;
    const panel = fileTreePanelRef.current;
    if (!group) return;

    const collapsed = panel?.isCollapsed() ?? isFileTreeCollapsed(group.getLayout());

    if (collapsed) {
      const restore = savedLayoutRef.current ?? {
        "file-tree": DEFAULT_WORKSPACE_FILES_LAYOUT["file-tree"],
        editor: DEFAULT_WORKSPACE_FILES_LAYOUT.editor,
      };
      group.setLayout(restore);
      panel?.expand();
      setFileTreeCollapsed(false);
      return;
    }

    savedLayoutRef.current = { ...group.getLayout() };
    programmaticCollapseRef.current = true;
    group.setLayout({ ...COLLAPSED_WORKSPACE_FILES_LAYOUT });
    panel?.collapse();
    setFileTreeCollapsed(true);
  }, [filesGroupRef, fileTreePanelRef]);

  const handleFileTreePanelResize = useCallback(
    (sizePct: number) => {
      if (sizePct < 0.5) return;

      const group = filesGroupRef.current;
      if (group) {
        savedLayoutRef.current = { ...group.getLayout() };
      }
      setFileTreeCollapsed(false);
    },
    [filesGroupRef],
  );

  return {
    filesGroupRef,
    fileTreePanelRef,
    fileTreeCollapsed,
    toggleFileTreePanel,
    handleFileTreePanelResize,
    recordVisibleFilesLayout,
  };
}
