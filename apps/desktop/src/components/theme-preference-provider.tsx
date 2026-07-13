import { useLocalStorageState } from "ahooks";
import { useMemo, type ReactNode } from "react";

import { ThemePreferenceContext } from "@/hooks/use-theme-preference";
import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useLocalStorageState<ThemePreference>(
    THEME_STORAGE_KEY,
    {
      defaultValue: "dark",
      deserializer: (raw) => (isThemePreference(raw) ? raw : "dark"),
      serializer: (value) => value,
    },
  );

  const value = useMemo(
    () => ({
      preference: preference ?? "dark",
      setPreference,
    }),
    [preference, setPreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}
