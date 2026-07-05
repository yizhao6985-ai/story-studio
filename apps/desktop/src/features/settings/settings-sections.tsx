import type { LucideIcon } from "lucide-react";
import { Code2, Palette } from "lucide-react";
import type { ComponentType } from "react";

import { AppearanceSettings } from "./sections/appearance-settings";
import { EditorSettings } from "./sections/editor-settings";

export type SettingsSectionId = "appearance" | "editor";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  Component: ComponentType;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "appearance",
    label: "外观",
    description: "主题与显示",
    icon: Palette,
    Component: AppearanceSettings,
  },
  {
    id: "editor",
    label: "编辑器",
    description: "字体与编辑行为",
    icon: Code2,
    Component: EditorSettings,
  },
];

export function getSettingsSection(id: SettingsSectionId): SettingsSection {
  const section = SETTINGS_SECTIONS.find((item) => item.id === id);
  if (!section) {
    return SETTINGS_SECTIONS[0];
  }
  return section;
}
