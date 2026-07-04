import { useCallback, useRef, useState } from "react";
import { useGroupRef, usePanelRef } from "react-resizable-panels";

import {
  COLLAPSED_APP_SHELL_LAYOUT,
  DEFAULT_APP_SHELL_LAYOUT,
} from "@/lib/panel-layout";

function isSidebarCollapsed(layout: Record<string, number>) {
  return (layout.sidebar ?? 0) < 0.5;
}

export function useSidebarPanelCollapse() {
  const shellGroupRef = useGroupRef();
  const sidebarPanelRef = usePanelRef();
  const savedLayoutRef = useRef<Record<string, number> | null>(null);

  const [sidebarPanelCollapsed, setSidebarPanelCollapsed] = useState(false);

  const recordVisibleShellLayout = useCallback((layout: Record<string, number>) => {
    if (!isSidebarCollapsed(layout)) {
      savedLayoutRef.current = { ...layout };
    }
    setSidebarPanelCollapsed(isSidebarCollapsed(layout));
  }, []);

  const toggleSidebarPanel = useCallback(() => {
    const group = shellGroupRef.current;
    if (!group) return;

    const layout = group.getLayout();
    const collapsed = isSidebarCollapsed(layout);

    if (collapsed) {
      const restore = savedLayoutRef.current ?? {
        sidebar: DEFAULT_APP_SHELL_LAYOUT.sidebar,
        main: DEFAULT_APP_SHELL_LAYOUT.main,
      };
      group.setLayout(restore);
      sidebarPanelRef.current?.expand();
      setSidebarPanelCollapsed(false);
      return;
    }

    savedLayoutRef.current = { ...layout };
    group.setLayout({ ...COLLAPSED_APP_SHELL_LAYOUT });
    sidebarPanelRef.current?.collapse();
    setSidebarPanelCollapsed(true);
  }, [shellGroupRef, sidebarPanelRef]);

  const handleSidebarPanelResize = useCallback(
    (sizePct: number) => {
      const collapsed = sizePct < 0.5;
      setSidebarPanelCollapsed(collapsed);

      if (!collapsed) {
        const group = shellGroupRef.current;
        if (group) {
          savedLayoutRef.current = { ...group.getLayout() };
        }
      }
    },
    [shellGroupRef],
  );

  return {
    shellGroupRef,
    sidebarPanelRef,
    sidebarPanelCollapsed,
    toggleSidebarPanel,
    handleSidebarPanelResize,
    recordVisibleShellLayout,
  };
}
