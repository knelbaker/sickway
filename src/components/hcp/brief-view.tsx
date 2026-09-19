import { BRIEF_SOURCE_LABEL } from "@/components/hcp/labels";
import { Badge } from "@/components/ui/badge";
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
    <section aria-labelledby="brief-heading" className="rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="brief-heading" className="text-sm font-semibold">
          Clinician brief (SBAR)
        </h3>
        <Badge variant={sbar.source === "generated" ? "default" : "secondary"}>{BRIEF_SOURCE_LABEL[sbar.source]}</Badge>
      </div>
      {children}
      <dl className="flex flex-col gap-3 text-sm leading-6">
        {SECTIONS.map(([key, label]) => (
          <div key={key}>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd>{sbar[key]}</dd>
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
