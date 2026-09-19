"use client";

import type { Dispatch } from "react";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
import type { DraftAction, IntakeDraft } from "@/components/student/use-intake-draft";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIsoWallTime, formatReportedList, isoToLocalInput, localInputToIso, NOT_REPORTED } from "@/lib/format";
import { RED_FLAG_DEFINITIONS } from "@/lib/red-flags";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", es: "Spanish" };

function parseList(text: string): string[] {
  return text.split(",").map((item) => item.trim()).filter(Boolean);
}

function SourceBadge({ source }: { source: "student review" | "synthetic profile" }) {
  return <Badge variant="outline">Source: {source}</Badge>;
}

function FieldRow({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <SourceBadge source="student review" />
      </div>
      {children}
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Every field is editable and every gap reads "not reported". The onset is only
 * ever confirmed by the student's own tick; editing the time clears it (§3, §6.1).
 */
export function ReviewForm({
  draft,
  dispatch,
  profile,
  onEditAnswers,
}: {
  draft: IntakeDraft;
  dispatch: Dispatch<DraftAction>;
  profile: StudentProfileSummary;
  onEditAnswers: () => void;
}) {
  const onsetText = formatIsoWallTime(draft.onsetIso);

  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="review-heading" className="text-base font-semibold">
          Review before sharing
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Correct anything that is wrong. Blank fields are shared as “{NOT_REPORTED}”, never as “no”.
        </p>
      </div>

      <FieldRow id="review-symptoms" label="Symptoms" hint="Separate symptoms with commas.">
        <Input
          id="review-symptoms"
          className="h-11"
          defaultValue={draft.symptoms.join(", ")}
          placeholder={NOT_REPORTED}
          onChange={(event) => dispatch({ type: "edit", field: "symptoms", value: parseList(event.target.value) })}
        />
      </FieldRow>

      <FieldRow id="review-temp" label="Highest temperature (°F)">
        <Input
          id="review-temp"
          className="h-11"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={90}
          max={110}
          defaultValue={draft.maxTempF ?? ""}
          placeholder={NOT_REPORTED}
          onChange={(event) => {
            const value = event.target.valueAsNumber;
            dispatch({ type: "edit", field: "maxTempF", value: Number.isFinite(value) ? value : null });
          }}
        />
      </FieldRow>

      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <FieldRow
          id="review-onset"
          label="When it started"
          hint={
            draft.onsetPhrase
              ? `You wrote “${draft.onsetPhrase}”. The time below was worked out from the displayed fixture clock (${formatIsoWallTime(profile.fixtureClock)}), not from today's real date.`
              : "Leave this empty if you are not sure."
          }
        >
          <Input
            id="review-onset"
            className="h-11"
            type="datetime-local"
            max={isoToLocalInput(profile.fixtureClock)}
            value={isoToLocalInput(draft.onsetIso)}
            onChange={(event) =>
              dispatch({ type: "onset", onsetIso: localInputToIso(event.target.value, profile.fixtureClock) })
            }
          />
        </FieldRow>
        <div className="flex items-center gap-3">
          <Checkbox
            id="confirm-onset"
            className="mt-0.5 size-5"
            checked={draft.onsetConfirmed}
            disabled={draft.onsetIso === null}
            onCheckedChange={(checked) => dispatch({ type: "confirmOnset", confirmed: checked === true })}
          />
          <Label htmlFor="confirm-onset" className="min-h-11 flex-1 items-center text-sm leading-6 font-normal">
            {onsetText ? `I confirm it started around ${onsetText}.` : "Add a time above to confirm it."}
          </Label>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {draft.onsetIso === null
            ? `Onset will be shared as “${NOT_REPORTED}”.`
            : draft.onsetConfirmed
              ? "Confirmed by you."
              : "Not confirmed: it will be shared as an unconfirmed time and no elapsed time will be shown."}
        </p>
      </div>

      <FieldRow id="review-deadline" label="Deadline today">
        <Input
          id="review-deadline"
          className="h-11"
          defaultValue={draft.deadlineToday ?? ""}
          placeholder={NOT_REPORTED}
          onChange={(event) =>
            dispatch({ type: "edit", field: "deadlineToday", value: event.target.value.trim() || null })
          }
        />
      </FieldRow>

      <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Your follow-up answers</h3>
          <button type="button" className="min-h-11 px-2 text-sm underline underline-offset-4" onClick={onEditAnswers}>
            Edit answers
          </button>
        </div>
        <dl className="flex flex-col gap-1.5">
          {RED_FLAG_DEFINITIONS.map((flag) => {
            const answer = draft.redFlags[flag.key];
            return (
              <div key={flag.key} className="flex flex-wrap justify-between gap-x-3">
                <dt>{flag.label}</dt>
                <dd className="font-medium">
                  {answer === true ? "Yes" : answer === false ? "No" : draft.notSure[flag.key] ? "Not sure" : "Not answered"}
                </dd>
              </div>
            );
          })}
          <div className="flex flex-wrap justify-between gap-x-3 border-t pt-1.5">
            <dt>Medications taken</dt>
            <dd className="font-medium">{formatReportedList(draft.medsTaken)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-3">
            <dt>Allergies</dt>
            <dd className="font-medium">{formatReportedList(draft.allergies)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Instruction languages</span>
        <span className="font-medium">
          {profile.instructionLanguages.map((code) => LANGUAGE_NAMES[code] ?? code).join(" and ")}
        </span>
        <SourceBadge source="synthetic profile" />
      </div>
    </section>
  );
}
