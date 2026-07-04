import { useCallback, useRef, useState } from "react";
import { useGroupRef, usePanelRef } from "react-resizable-panels";

import {
  COLLAPSED_APP_CONTENT_LAYOUT,
  DEFAULT_APP_CONTENT_LAYOUT,
  PANEL_LAYOUT_IDS,
  savePanelLayout,
} from "@/lib/panel-layout";

function isWorkspaceCollapsed(layout: Record<string, number>) {
  return (layout.workspace ?? 0) < 0.5;
}

export function useWorkspacePanelCollapse() {
  const contentGroupRef = useGroupRef();
  const conversationPanelRef = usePanelRef();
  const workspacePanelRef = usePanelRef();
  const savedLayoutRef = useRef<Record<string, number> | null>(null);

  const [workspacePanelCollapsed, setWorkspacePanelCollapsed] = useState(false);

  const recordVisibleContentLayout = useCallback((layout: Record<string, number>) => {
    if (!isWorkspaceCollapsed(layout)) {
      savedLayoutRef.current = { ...layout };
    }
    setWorkspacePanelCollapsed(isWorkspaceCollapsed(layout));
  }, []);

  const toggleWorkspacePanel = useCallback(() => {
    const group = contentGroupRef.current;
    const workspacePanel = workspacePanelRef.current;
    if (!group) return;

    const layout = group.getLayout();
    const collapsed =
      workspacePanel?.isCollapsed() ?? isWorkspaceCollapsed(layout);

    if (collapsed) {
      const restore = savedLayoutRef.current ?? {
        conversation: DEFAULT_APP_CONTENT_LAYOUT.conversation,
        workspace: DEFAULT_APP_CONTENT_LAYOUT.workspace,
      };
      group.setLayout(restore);
      savePanelLayout(PANEL_LAYOUT_IDS.appContent, restore);
      workspacePanelRef.current?.expand();
      setWorkspacePanelCollapsed(false);
      return;
    }

    savedLayoutRef.current = { ...layout };
    group.setLayout({ ...COLLAPSED_APP_CONTENT_LAYOUT });
    savePanelLayout(PANEL_LAYOUT_IDS.appContent, COLLAPSED_APP_CONTENT_LAYOUT);
    workspacePanelRef.current?.collapse();
    setWorkspacePanelCollapsed(true);
  }, [contentGroupRef, workspacePanelRef]);

  const handleWorkspacePanelResize = useCallback(
    (sizePct: number) => {
      const collapsed = sizePct < 0.5;

      setWorkspacePanelCollapsed(collapsed);

      if (!collapsed) {
        const group = contentGroupRef.current;
        if (group) {
          savedLayoutRef.current = { ...group.getLayout() };
        }
      }
    },
    [contentGroupRef],
  );

  const syncContentLayout = useCallback(() => {
    if (!workspacePanelCollapsed) return;

    const group = contentGroupRef.current;
    if (!group || isWorkspaceCollapsed(group.getLayout())) return;

    group.setLayout({ ...COLLAPSED_APP_CONTENT_LAYOUT });
    workspacePanelRef.current?.collapse();
  }, [workspacePanelCollapsed, contentGroupRef, workspacePanelRef]);

  return {
    contentGroupRef,
    conversationPanelRef,
    workspacePanelRef,
    workspacePanelCollapsed,
    toggleWorkspacePanel,
    handleWorkspacePanelResize,
    recordVisibleContentLayout,
    syncContentLayout,
  };
}
