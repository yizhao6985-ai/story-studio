import { createContext, useContext } from "react";

import type { ThemePreference } from "@/lib/theme";

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

export const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error("useThemePreference must be used within ThemePreferenceProvider");
  }
  return [context.preference, context.setPreference];
}
