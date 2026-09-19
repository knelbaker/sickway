"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/client/language-store";
import { formatIsoWallTime, formatReportedList } from "@/lib/format";
import { RED_FLAG_KEYS } from "@/lib/red-flags";
import type { ReviewedIntake } from "@/lib/schemas";

/**
 * The scripted Scene 1 case, shown exactly as it will be shared. Choosing it is
 * an explicit action; it is never substituted for what someone typed (§4.1).
 * Consent is still separate and unticked.
 */
export function PreparedDemoSummary({ intake }: { intake: ReviewedIntake }) {
  const { language, t } = useLanguage();
  const NOT_REPORTED = t.common.notReported;
  const reported = { notReported: t.common.notReported, noneReported: t.common.noneReported };
  return (
    <section aria-labelledby="prepared-heading" className="flex flex-col gap-3">
      <Alert>
        <AlertTitle id="prepared-heading" className="flex flex-wrap items-center gap-2">
          {t.prepared.title} <Badge variant="secondary">{t.prepared.badge}</Badge>
        </AlertTitle>
        <AlertDescription>
          {t.prepared.body} {t.prepared.scriptLanguageNote}
        </AlertDescription>
      </Alert>
      {/* Every value below is scripted. Say so once where it can be read at a glance; each row still
          carries the same attribution for screen readers, so no value is ever unattributed. */}
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        {t.prepared.allFixture}
        <Badge variant="outline" className="font-normal">{t.prepared.fixture}</Badge>
      </p>
      <dl className="flex flex-col rounded-2xl border border-ink/12 bg-paper/70 px-4 text-sm">
        {[
          [t.prepared.words, `“${intake.transcript}”`],
          [t.prepared.symptoms, intake.symptoms.join(", ") || NOT_REPORTED],
          [t.prepared.temperature, intake.maxTempF === null ? NOT_REPORTED : `${intake.maxTempF}°F`],
          [t.prepared.onset, `${formatIsoWallTime(intake.onsetIso, language) ?? NOT_REPORTED}${intake.onsetConfirmed ? ` — ${t.prepared.confirmedInScript}` : ""}`],
          [t.prepared.deadline, intake.deadlineToday ?? NOT_REPORTED],
          [t.prepared.meds, formatReportedList(intake.medsTaken, reported)],
          [t.prepared.allergies, formatReportedList(intake.allergies, reported)],
          ...RED_FLAG_KEYS.map((key) => {
            const answer = intake.redFlags[key];
            return [t.followUps.redFlags[key].label, answer === true ? t.common.yes : answer === false ? t.prepared.noScripted : NOT_REPORTED];
          }),
        ].map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-x-6 gap-y-0.5 border-t border-ink/10 py-2.5 first:border-t-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">
              {value} <span className="sr-only">{t.prepared.fixture}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
