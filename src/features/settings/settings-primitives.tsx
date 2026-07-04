import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SettingsPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl animate-fade-in">
      <header className="mb-7">
        <h2 className="text-base font-medium tracking-tight text-foreground">{title}</h2>
        <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function SettingsGroup({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      {title || description ? (
        <div className="mb-2.5 px-1">
          {title ? (
            <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {title}
            </h3>
          ) : null}
          {description ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/80">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="surface-elevated divide-y divide-border border border-border">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  align = "center",
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "flex gap-6 px-4 py-3.5",
        align === "center" ? "items-center" : "items-start",
      )}
    >
      <div className="min-w-0 flex-1">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
          {label}
        </Label>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className={cn("shrink-0", align === "start" && "pt-0.5")}>{children}</div>
    </div>
  );
}

type SegmentedOption<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap border border-border bg-foreground/2 p-px",
        className,
      )}
      role="group"
    >
      {options.map((option) => {
        const isActive = value === option.id;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] transition-colors duration-100",
              isActive
                ? "bg-foreground/8 font-medium text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-muted-foreground hover:bg-foreground/4 hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemePicker<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const isActive = value === option.id;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex flex-col items-center gap-2 border px-3 py-4 transition-colors duration-100",
              isActive
                ? "border-foreground/25 bg-foreground/6 text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:border-foreground/15 hover:bg-foreground/3 hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
            <span className="text-[11px] font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
