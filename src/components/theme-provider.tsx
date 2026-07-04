import { useEffect } from "react";

import { applyThemeToDocument, resolveTheme } from "@/lib/theme";
import { useSystemTheme } from "@/hooks/use-system-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { ThemePreferenceProvider } from "@/components/theme-preference-provider";

function ThemeApplier({ children }: { children: React.ReactNode }) {
  const [preference] = useThemePreference();
  const systemTheme = useSystemTheme();
  const resolved = preference === "system" ? systemTheme : resolveTheme(preference);

  useEffect(() => {
    applyThemeToDocument(resolved);
  }, [resolved]);

  return children;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemePreferenceProvider>
      <ThemeApplier>{children}</ThemeApplier>
    </ThemePreferenceProvider>
  );
}
