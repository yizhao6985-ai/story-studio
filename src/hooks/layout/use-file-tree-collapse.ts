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

  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false);

  const recordVisibleFilesLayout = useCallback((layout: Record<string, number>) => {
    if (!isFileTreeCollapsed(layout)) {
      savedLayoutRef.current = { ...layout };
    }
    setFileTreeCollapsed(isFileTreeCollapsed(layout));
  }, []);

  const toggleFileTreePanel = useCallback(() => {
    const group = filesGroupRef.current;
    if (!group) return;

    const layout = group.getLayout();
    const collapsed = isFileTreeCollapsed(layout);

    if (collapsed) {
      const restore = savedLayoutRef.current ?? {
        "file-tree": DEFAULT_WORKSPACE_FILES_LAYOUT["file-tree"],
        editor: DEFAULT_WORKSPACE_FILES_LAYOUT.editor,
      };
      group.setLayout(restore);
      fileTreePanelRef.current?.expand();
      setFileTreeCollapsed(false);
      return;
    }

    savedLayoutRef.current = { ...layout };
    group.setLayout({ ...COLLAPSED_WORKSPACE_FILES_LAYOUT });
    fileTreePanelRef.current?.collapse();
    setFileTreeCollapsed(true);
  }, [filesGroupRef, fileTreePanelRef]);

  const handleFileTreePanelResize = useCallback(
    (sizePct: number) => {
      const collapsed = sizePct < 0.5;
      setFileTreeCollapsed(collapsed);

      if (!collapsed) {
        const group = filesGroupRef.current;
        if (group) {
          savedLayoutRef.current = { ...group.getLayout() };
        }
      }
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
