import { cn } from "@/lib/utils";

export type ContextUsageInfo = {
  percent: number;
  usedTokens: number;
  budgetTokens: number;
  hasSummary: boolean;
  modelLabel?: string;
};

type ContextUsageMeterProps = {
  usage: ContextUsageInfo | null;
  className?: string;
};

function formatTokenCount(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return String(value);
}

function usageTone(percent: number): string {
  if (percent >= 85) return "text-destructive";
  if (percent >= 60) return "text-warning";
  return "text-muted-foreground";
}

function fillTone(percent: number): string {
  if (percent >= 85) return "bg-destructive";
  if (percent >= 60) return "bg-warning";
  return "bg-foreground/35";
}

export function ContextUsageMeter({ usage, className }: ContextUsageMeterProps) {
  if (!usage) return null;

  const { percent, usedTokens, budgetTokens, hasSummary, modelLabel } = usage;
  const clamped = Math.min(100, Math.max(0, percent));

  const tooltip = [
    `上下文约 ${clamped}%`,
    `约 ${formatTokenCount(usedTokens)} / ${formatTokenCount(budgetTokens)}`,
    hasSummary ? "已压缩早期对话" : null,
    modelLabel ? modelLabel : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn("flex shrink-0 items-center gap-1.5", className)}
      title={tooltip}
      aria-label={tooltip}
    >
      <div
        className="h-1 w-14 overflow-hidden rounded-full bg-foreground/10"
        aria-hidden
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            fillTone(clamped),
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span
        className={cn(
          "min-w-[2ch] text-[10px] font-medium tabular-nums leading-none",
          usageTone(clamped),
        )}
      >
        {clamped}%
      </span>
    </div>
  );
}
