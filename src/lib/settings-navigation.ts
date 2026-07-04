import type { SettingsSectionId } from "@/features/settings/settings-sections";

export const OPEN_SETTINGS_EVENT = "storyStudio:open-settings";

export type OpenSettingsDetail = {
  section?: SettingsSectionId;
};

export function requestOpenSettings(section: SettingsSectionId = "appearance") {
  window.dispatchEvent(
    new CustomEvent<OpenSettingsDetail>(OPEN_SETTINGS_EVENT, {
      detail: { section },
    }),
  );
}
