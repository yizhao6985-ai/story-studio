import { Monitor, Moon, Sun } from "lucide-react";

import { THEME_PREFERENCE_LABELS, type ThemePreference } from "@/lib/theme";
import { useThemePreference } from "@/hooks/use-theme-preference";

import {
  SettingsGroup,
  SettingsPage,
  ThemePicker,
} from "../settings-primitives";

const THEME_OPTIONS = [
  { id: "light" as const, label: THEME_PREFERENCE_LABELS.light, icon: Sun },
  { id: "dark" as const, label: THEME_PREFERENCE_LABELS.dark, icon: Moon },
  { id: "system" as const, label: THEME_PREFERENCE_LABELS.system, icon: Monitor },
];

export function AppearanceSettings() {
  const [preference, setPreference] = useThemePreference();

  return (
    <SettingsPage title="外观" description="选择应用界面的颜色主题，影响编辑器与整体界面。">
      <SettingsGroup title="主题">
        <div className="p-4">
          <ThemePicker<ThemePreference>
            value={preference}
            options={THEME_OPTIONS}
            onChange={setPreference}
          />
        </div>
      </SettingsGroup>
    </SettingsPage>
  );
}
