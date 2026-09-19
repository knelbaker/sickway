import { BriefSourceBadge } from "@/components/brief-source-badge";
import type { Sbar } from "@/lib/schemas";

const SECTIONS = [
  ["situation", "Situation"],
  ["background", "Background"],
  ["assessment", "Assessment"],
  ["recommendation", "Recommendation"],
] as const;

/** The brief as visible text, always with its source. Audio controls are passed in by the caller. */
export function BriefView({ sbar, children }: { sbar: Sbar; children?: React.ReactNode }) {
  return (
    <section aria-labelledby="brief-heading" className="rounded-2xl border border-rule bg-paper p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="brief-heading" className="display text-2xl">
          Clinician brief (SBAR)
        </h3>
        <BriefSourceBadge source={sbar.source} />
      </div>
      {children}
      <dl className="flex flex-col divide-y divide-rule">
        {SECTIONS.map(([key, label]) => (
          <div key={key} className="grid grid-cols-[2.75rem_1fr] gap-x-3 py-4 first:pt-1 sm:grid-cols-[3.5rem_1fr]">
            <span aria-hidden className="display text-5xl text-brand-red sm:text-6xl">
              {label[0]}
            </span>
            <div>
              <dt className="text-sm font-bold">{label}</dt>
              <dd className="mt-1 text-base leading-7">{sbar[key]}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Demo routing result, not a diagnosis or clinically validated triage. The clinician remains
        responsible for every decision.
      </p>
    </section>
  );
}
