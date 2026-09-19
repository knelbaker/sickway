"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Where the student is in the visit. The logo's red line is the thread: it has
 * been drawn as far as the current step, and the rest is still to come.
 */
export function StepThread({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <nav aria-label={label}>
      {/* Equal flexible columns, so long labels ("Revisar y compartir") wrap instead of pushing the card wider. */}
      <ol className="relative flex">
        <span
          aria-hidden
          className="absolute top-[15px] h-[3px] rounded-full bg-rule"
          style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}
        />
        <span
          aria-hidden
          className="absolute top-[15px] h-[3px] rounded-full bg-brand-red transition-[width] duration-500 ease-out"
          style={{
            left: `${50 / steps.length}%`,
            width: `${(100 - 100 / steps.length) * (Math.min(current, steps.length - 1) / (steps.length - 1))}%`,
          }}
        />
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step} aria-current={active ? "step" : undefined} className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1.5 px-0.5 text-center">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-[3px] text-sm font-bold transition-colors duration-300",
                  done && "border-brand-red bg-brand-red text-white",
                  active && "border-ink bg-ink text-paper",
                  !done && !active && "border-rule bg-paper text-ink-soft",
                )}
              >
                {done ? <Check aria-hidden className="size-4" strokeWidth={3.5} /> : index + 1}
              </span>
              <span className={cn("max-w-full text-[0.6875rem] leading-4 break-words hyphens-auto sm:text-sm", active ? "font-bold text-ink" : "text-ink-soft")}>{step}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
