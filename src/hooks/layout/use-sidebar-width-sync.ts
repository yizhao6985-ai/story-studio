import { useEffect, type RefObject } from "react";
import { useElementSize } from "@/hooks/lib/browser";

export function useSidebarWidthSync(ref: RefObject<HTMLElement | null>) {
  const size = useElementSize(ref);

  useEffect(() => {
    if (size?.width == null) return;
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      `${size.width}px`,
    );
  }, [size?.width]);
}
