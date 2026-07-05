export const THEME_STORAGE_KEY = "story-studio-theme";

export type ThemePreference = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredThemePreference(): ThemePreference {
  const raw =
    typeof localStorage !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) : null;
  return isThemePreference(raw) ? raw : "dark";
}

export function writeStoredThemePreference(preference: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, preference);
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

export function applyThemeToDocument(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function initThemeFromStorage() {
  applyThemeToDocument(resolveTheme(readStoredThemePreference()));
}

export const THEME_PREFERENCE_LABELS: Record<ThemePreference, string> = {
  light: "白色",
  dark: "黑色",
  system: "跟随系统",
};
