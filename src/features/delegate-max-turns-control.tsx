import { Minus, Plus } from "lucide-react";

import {
  DELEGATE_MAX_TURNS_MAX,
  DELEGATE_MAX_TURNS_MIN,
} from "@/hooks/types";
import { COMPOSER_TAG_BUTTON_CLASS } from "@/lib/composer-chrome";
import { cn } from "@/lib/utils";

type DelegateMaxTurnsControlProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

function clampMaxTurns(value: number): number {
  return Math.min(DELEGATE_MAX_TURNS_MAX, Math.max(DELEGATE_MAX_TURNS_MIN, value));
}

const STEPPER_BUTTON_CLASS =
  "inline-flex h-full w-7 shrink-0 cursor-pointer items-center justify-center text-delegate/75 transition-colors hover:bg-delegate/15 hover:text-delegate active:bg-delegate/25 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:active:bg-transparent";

export function DelegateMaxTurnsControl({
  value,
  onChange,
  disabled = false,
  className,
}: DelegateMaxTurnsControlProps) {
  const atMin = value <= DELEGATE_MAX_TURNS_MIN;
  const atMax = value >= DELEGATE_MAX_TURNS_MAX;

  return (
    <div
      className={cn(
        COMPOSER_TAG_BUTTON_CLASS,
        "gap-0 overflow-hidden p-0",
        "border-delegate/25 bg-delegate/10 text-delegate",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      title={`最大轮数 ${value}`}
      role="group"
      aria-label={`最大轮数 ${value}`}
    >
      <button
        type="button"
        disabled={disabled || atMin}
        aria-label="减少最大轮数"
        onClick={() => onChange(clampMaxTurns(value - 1))}
        className={cn(STEPPER_BUTTON_CLASS, "border-r border-delegate/15")}
      >
        <Minus className="size-3" strokeWidth={2.25} />
      </button>
      <span
        className="min-w-[2rem] select-none px-1 text-center tabular-nums font-medium tracking-tight"
        aria-live="polite"
        aria-atomic="true"
      >
        {value}
      </span>
      <button
        type="button"
        disabled={disabled || atMax}
        aria-label="增加最大轮数"
        onClick={() => onChange(clampMaxTurns(value + 1))}
        className={cn(STEPPER_BUTTON_CLASS, "border-l border-delegate/15")}
      >
        <Plus className="size-3" strokeWidth={2.25} />
      </button>
    </div>
  );
}
