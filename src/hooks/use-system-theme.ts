import { useSyncExternalStore } from "react";

import { getSystemTheme, type ResolvedTheme } from "@/lib/theme";

function subscribeSystemTheme(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

export function useSystemTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeSystemTheme, getSystemTheme, () => "dark");
}
