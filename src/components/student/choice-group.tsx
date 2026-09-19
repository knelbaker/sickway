"use client";

import { cn } from "cn";

export type Choice<T> = { label: string; value: T };

/**
 * A row of mutually exclusive choices with radio semantics. `selected` is the
 * index of the chosen option, or null when nothing has been chosen yet: there
 * is never a default selection.
 */
export function ChoiceGroup<T>({
  label,
  choices,
  selected,
  onSelect,
}: {
  label: string;
  choices: Choice<T>[];
  selected: number | null;
  onSelect: (index: number, value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {choices.map((choice, index) => {
        const checked = selected === index;
        return (
          <button
            key={choice.label}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onSelect(index, choice.value)}
            className={cn(
              "min-h-11 min-w-20 rounded-md border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              checked ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
