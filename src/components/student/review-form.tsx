"use client";

import type { Dispatch } from "react";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
import type { DraftAction, IntakeDraft } from "@/components/student/use-intake-draft";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/client/language-store";
import { formatIsoWallTime, formatReportedList, isoToLocalInput, localInputToIso } from "@/lib/format";
import { LANGUAGES } from "@/lib/i18n/messages";
import { RED_FLAG_KEYS } from "@/lib/red-flags";
import type { InstructionLanguage } from "@/lib/schemas";

function parseList(text: string): string[] {
  return text.split(",").map((item) => item.trim()).filter(Boolean);
}

function SourceBadge({ source }: { source: "student" | "profile" }) {
  const { t } = useLanguage();
  return <Badge variant="outline">{source === "student" ? t.common.sourceStudent : t.common.sourceProfile}</Badge>;
}

function FieldRow({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <SourceBadge source="student" />
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
  preferredLanguages,
  onPreferredLanguagesChange,
  onEditAnswers,
}: {
  draft: IntakeDraft;
  dispatch: Dispatch<DraftAction>;
  profile: StudentProfileSummary;
  /** The student's own choice; it starts from the displayed profile selection (§6.1). */
  preferredLanguages: InstructionLanguage[];
  onPreferredLanguagesChange: (languages: InstructionLanguage[]) => void;
  onEditAnswers: () => void;
}) {
  const { language, t } = useLanguage();
  const NOT_REPORTED = t.common.notReported;
  const reported = { notReported: t.common.notReported, noneReported: t.common.noneReported };
  const onsetText = formatIsoWallTime(draft.onsetIso, language);

  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="review-heading" className="text-base font-semibold">
          {t.review.title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {t.review.intro(NOT_REPORTED)}
        </p>
      </div>

      {/* What the student typed, unchanged, so every field below can be checked against it. */}
      {draft.transcript && (
        <figure className="rounded-2xl border border-ink/12 bg-paper/70 p-4">
          <figcaption className="text-sm font-semibold">{t.review.yourWords}</figcaption>
          <blockquote className="mt-1.5 leading-7">“{draft.transcript}”</blockquote>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{t.review.yourWordsNote}</p>
        </figure>
      )}

      <FieldRow id="review-symptoms" label={t.review.symptoms} hint={t.review.symptomsHint}>
        <Input
          id="review-symptoms"
          className="h-11"
          defaultValue={draft.symptoms.join(", ")}
          placeholder={NOT_REPORTED}
          onChange={(event) => dispatch({ type: "edit", field: "symptoms", value: parseList(event.target.value) })}
        />
      </FieldRow>

      <FieldRow id="review-temp" label={t.review.temperature}>
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
          label={t.review.onset}
          hint={
            draft.onsetPhrase
              ? t.review.onsetHintPhrase(draft.onsetPhrase, formatIsoWallTime(profile.fixtureClock, language) ?? "")
              : t.review.onsetHintEmpty
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
            {onsetText ? t.review.confirmOnset(onsetText) : t.review.confirmOnsetEmpty}
          </Label>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {draft.onsetIso === null
            ? t.review.onsetWillBeNotReported(NOT_REPORTED)
            : draft.onsetConfirmed
              ? t.review.onsetConfirmed
              : t.review.onsetUnconfirmed}
        </p>
      </div>

      <FieldRow id="review-deadline" label={t.review.deadline}>
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
          <h3 className="font-semibold">{t.review.answersTitle}</h3>
          <button type="button" className="min-h-11 px-2 text-sm underline underline-offset-4" onClick={onEditAnswers}>
            {t.review.editAnswers}
          </button>
        </div>
        <dl className="flex flex-col gap-1.5">
          {RED_FLAG_KEYS.map((key) => ({ key, label: t.followUps.redFlags[key].label })).map((flag) => {
            const answer = draft.redFlags[flag.key];
            return (
              <div key={flag.key} className="flex flex-wrap justify-between gap-x-3">
                <dt>{flag.label}</dt>
                <dd className="font-medium">
                  {answer === true ? t.common.yes : answer === false ? t.common.no : draft.notSure[flag.key] ? t.common.notSure : t.common.notAnswered}
                </dd>
              </div>
            );
          })}
          <div className="flex flex-wrap justify-between gap-x-3 border-t pt-1.5">
            <dt>{t.review.meds}</dt>
            <dd className="font-medium">{formatReportedList(draft.medsTaken, reported)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-3">
            <dt>{t.review.allergies}</dt>
            <dd className="font-medium">{formatReportedList(draft.allergies, reported)}</dd>
          </div>
        </dl>
      </div>

      <fieldset className="flex flex-col gap-1 rounded-lg border p-3">
        <legend className="flex flex-wrap items-center gap-2 px-1 text-sm font-medium">
          {t.review.languages} <SourceBadge source="student" />
        </legend>
        <p className="text-xs leading-5 text-muted-foreground">{t.review.languagesHelp}</p>
        {LANGUAGES.map((option) => (
          <div key={option.code} className="flex items-center gap-3">
            <Checkbox
              id={`preferred-language-${option.code}`}
              className="size-5"
              checked={preferredLanguages.includes(option.code)}
              onCheckedChange={(checked) =>
                onPreferredLanguagesChange(
                  LANGUAGES.map((item) => item.code).filter((code) =>
                    code === option.code ? checked === true : preferredLanguages.includes(code),
                  ),
                )
              }
            />
            <Label htmlFor={`preferred-language-${option.code}`} lang={option.code} className="min-h-11 flex-1 items-center font-normal">
              {option.name}
            </Label>
          </div>
        ))}
        {preferredLanguages.length === 0 && (
          <p role="alert" className="text-sm">
            {t.review.languagesNeedOne}
          </p>
        )}
      </fieldset>
    </section>
  );
}
