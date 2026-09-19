import { Badge } from "@/components/ui/badge";
import type { IntakeDraft } from "@/components/student/use-intake-draft";
import { formatIsoWallTime, NOT_REPORTED } from "@/lib/format";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}

/** What was picked up from the student's own words. Gaps read "not reported"; nothing is inferred. */
export function CandidateSummary({ draft }: { draft: IntakeDraft }) {
  const suggested = formatIsoWallTime(draft.onsetIso);

  return (
    <section aria-labelledby="candidate-heading" className="rounded-lg border p-4">
      <h2 id="candidate-heading" className="mb-1 text-sm font-semibold">
        {draft.extracted ? "Picked up from what you wrote" : "Nothing was filled in automatically"}
      </h2>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">
        You will review and correct every field before anything is shared.
      </p>
      <dl className="flex flex-col gap-2 text-sm">
        <Field label="Symptoms">{draft.symptoms.length > 0 ? draft.symptoms.join(", ") : NOT_REPORTED}</Field>
        <Field label="Temperature">{draft.maxTempF === null ? NOT_REPORTED : `${draft.maxTempF}°F`}</Field>
        <Field label="Started">
          {draft.onsetPhrase ? `“${draft.onsetPhrase}”` : NOT_REPORTED}
          {suggested && <Badge variant="outline">Suggested: {suggested} — not confirmed</Badge>}
        </Field>
        <Field label="Deadline today">{draft.deadlineToday ?? NOT_REPORTED}</Field>
      </dl>
    </section>
  );
}
