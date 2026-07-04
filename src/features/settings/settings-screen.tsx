import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import {
  getSettingsSection,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "./settings-sections";

type SettingsScreenProps = {
  initialSectionId?: SettingsSectionId;
};

export function SettingsScreen({
  initialSectionId = SETTINGS_SECTIONS[0]!.id,
}: SettingsScreenProps) {
  const [activeSectionId, setActiveSectionId] =
    useState<SettingsSectionId>(initialSectionId);

  useEffect(() => {
    setActiveSectionId(initialSectionId);
  }, [initialSectionId]);

  const activeSection = getSettingsSection(activeSectionId);
  const ActiveSection = activeSection.Component;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <nav className="surface-sidebar flex w-[220px] shrink-0 flex-col border-r border-border px-2 py-4">
          <p className="mb-3 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
            设置
          </p>
          <ul className="space-y-0.5">
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSectionId;

              return (
                <li key={section.id}>
                  <button
                    type="button"
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-left transition-colors duration-100",
                      isActive
                        ? "bg-foreground/6 text-foreground"
                        : "text-muted-foreground hover:bg-foreground/3 hover:text-foreground",
                    )}
                    onClick={() => setActiveSectionId(section.id)}
                  >
                    {isActive ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-2 left-0 w-0.5 bg-foreground"
                      />
                    ) : null}
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center border transition-colors",
                        isActive
                          ? "border-border bg-foreground/4 text-foreground"
                          : "border-transparent text-muted-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{section.label}</span>
                      <span className="block truncate text-[11px] leading-snug text-muted-foreground">
                        {section.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="surface-glass min-h-0 min-w-0 flex-1 overflow-y-auto px-8 py-8 text-left">
          <ActiveSection />
        </main>
      </div>
    </div>
  );
}
