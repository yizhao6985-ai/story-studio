import { resolveTheme } from "@/lib/theme";
import { useSystemTheme } from "@/hooks/use-system-theme";
import { useThemePreference } from "@/hooks/use-theme-preference";

export function useResolvedTheme() {
  const [preference] = useThemePreference();
  const systemTheme = useSystemTheme();
  return preference === "system" ? systemTheme : resolveTheme(preference);
}
