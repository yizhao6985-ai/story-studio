import { useEventListener, useMemoizedFn } from "ahooks";
import type { RefObject } from "react";

export function useOverlayDismiss(
  open: boolean,
  menuRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  const dismiss = useMemoizedFn(onDismiss);

  useEventListener(
    "pointerdown",
    (event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      dismiss();
    },
    { enable: open },
  );

  useEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") dismiss();
    },
    { enable: open },
  );

  useEventListener("scroll", dismiss, { enable: open, capture: true });
  useEventListener("resize", dismiss, { enable: open });
}
