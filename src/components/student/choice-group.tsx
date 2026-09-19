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
              "min-h-11 min-w-20 cursor-pointer rounded-full border-2 px-5 text-sm font-semibold transition-colors duration-200",
              checked ? "border-ink bg-ink text-paper" : "border-ink/20 bg-paper hover:border-ink",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
