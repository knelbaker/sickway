"use client";

import type { StudentProfileSummary } from "@/components/student/profile-summary";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/client/language-store";
import { formatIsoWallTime, formatMockDollars, formatReportedList } from "@/lib/format";
import { RED_FLAG_DEFINITIONS } from "@/lib/red-flags";
import type { Encounter } from "@/lib/schemas";

function Row({ label, source, children }: { label: string; source: string | undefined; children: React.ReactNode }) {
  const labels: Record<string, string> = useLanguage().t.clinician.fieldSource;
  return (
    <div className="flex flex-col gap-0.5 border-t py-2 first:border-t-0 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex flex-1 flex-wrap items-center gap-2">
        <span>{children}</span>
        <Badge variant="outline" className="font-normal">
          {labels[source ?? ""] ?? labels.none}
        </Badge>
      </dd>
    </div>
  );
}

/** The reviewed values behind the brief, each with where it came from, so grounding can be inspected (§7.2). */
export function SourcePanel({ encounter, profile }: { encounter: Encounter; profile: StudentProfileSummary }) {
  const { language, t } = useLanguage();
  const s = t.clinician.sources;
  const NOT_REPORTED = t.common.notReported;
  const reported = { notReported: t.common.notReported, noneReported: t.common.noneReported };
  const { intake, fieldSources } = encounter;
  const onset = formatIsoWallTime(intake.onsetIso, language);

  return (
    <section aria-labelledby="sources-heading" className="glass rounded-3xl p-5 sm:p-6">
      <h3 id="sources-heading" className="display text-xl">
        {s.title}
      </h3>
      <p className="mb-2 text-xs leading-5 text-muted-foreground">
        {s.body(NOT_REPORTED)}
      </p>
      <dl className="text-sm">
        <Row label={s.patient} source={fieldSources.name}>
          {profile.name}, {profile.age}
        </Row>
        <Row label={s.plan} source={fieldSources.plan}>
          {profile.planName} <Badge variant="secondary">{profile.planMockLabel}</Badge>
        </Row>
        <Row label={s.languages} source={fieldSources.instructionLanguages}>
          {(encounter.preferredInstructionLanguages ?? profile.instructionLanguages)
            .map((code) => s.languageNames[code] ?? code)
            .join(` ${t.common.and} `)}
        </Row>
        <Row label={s.costCeiling} source={fieldSources.costCeiling}>
          {profile.costCeiling === null ? s.notSet : `${formatMockDollars(profile.costCeiling)} ${s.fictional}`}
        </Row>
        <Row label={s.symptoms} source={fieldSources.symptoms}>
          {intake.symptoms.length > 0 ? intake.symptoms.join(", ") : NOT_REPORTED}
        </Row>
        <Row label={s.temperature} source={fieldSources.maxTempF}>
          {intake.maxTempF === null ? NOT_REPORTED : `${intake.maxTempF}°F`}
        </Row>
        <Row label={s.onset} source={fieldSources.onsetIso}>
          {onset ? `${onset} — ${intake.onsetConfirmed ? s.onsetConfirmed : s.onsetNotConfirmed}` : NOT_REPORTED}
        </Row>
        <Row label={s.deadline} source={fieldSources.deadlineToday}>
          {intake.deadlineToday ?? NOT_REPORTED}
        </Row>
        <Row label={s.meds} source={fieldSources.medsTaken}>
          {formatReportedList(intake.medsTaken, reported)}
        </Row>
        <Row label={s.allergies} source={fieldSources.allergies}>
          {formatReportedList(intake.allergies, reported)}
        </Row>
        {RED_FLAG_DEFINITIONS.map((flag) => {
          const answer = intake.redFlags[flag.key];
          return (
            <Row key={flag.key} label={t.followUps.redFlags[flag.key].label} source={fieldSources.redFlags}>
              {answer === true ? t.common.yes : answer === false ? t.common.no : NOT_REPORTED}
            </Row>
          );
        })}
        <Row label={s.words} source={fieldSources.transcript}>
          {intake.transcript ? `“${intake.transcript}”` : NOT_REPORTED}
        </Row>
      </dl>
    </section>
  );
}
