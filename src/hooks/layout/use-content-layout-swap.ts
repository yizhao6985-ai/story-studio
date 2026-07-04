import { useCallback, useState } from "react";

const STORAGE_KEY = "storyStudio.contentLayoutSwapped";

function readContentLayoutSwapped(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveContentLayoutSwapped(swapped: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, swapped ? "1" : "0");
  } catch {
    // ignore quota / private mode errors
  }
}

export function useContentLayoutSwap() {
  const [contentLayoutSwapped, setContentLayoutSwapped] = useState(readContentLayoutSwapped);

  const toggleContentLayout = useCallback(() => {
    setContentLayoutSwapped((prev) => {
      const next = !prev;
      saveContentLayoutSwapped(next);
      return next;
    });
  }, []);

  return {
    contentLayoutSwapped,
    toggleContentLayout,
  };
}
