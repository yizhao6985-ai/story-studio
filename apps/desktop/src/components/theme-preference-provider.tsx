import { useCallback, useMemo, useState, type ReactNode } from "react";

import { readStoredThemePreference, writeStoredThemePreference } from "@/lib/theme";
import { ThemePreferenceContext } from "@/hooks/use-theme-preference";

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readStoredThemePreference);

  const setPreference = useCallback((next: ReturnType<typeof readStoredThemePreference>) => {
    writeStoredThemePreference(next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      setPreference,
    }),
    [preference, setPreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}
