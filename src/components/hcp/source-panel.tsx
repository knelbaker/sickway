import { FIELD_SOURCE_LABEL } from "@/components/hcp/labels";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
import { Badge } from "@/components/ui/badge";
import { formatIsoWallTime, formatMockDollars, formatReportedList, NOT_REPORTED } from "@/lib/format";
import { RED_FLAG_DEFINITIONS } from "@/lib/red-flags";
import type { Encounter } from "@/lib/schemas";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", es: "Spanish" };

function Row({ label, source, children }: { label: string; source: string | undefined; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t py-2 first:border-t-0 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex flex-1 flex-wrap items-center gap-2">
        <span>{children}</span>
        <Badge variant="outline" className="font-normal">
          {FIELD_SOURCE_LABEL[source ?? ""] ?? "source not recorded"}
        </Badge>
      </dd>
    </div>
  );
}

/** The reviewed values behind the brief, each with where it came from, so grounding can be inspected (§7.2). */
export function SourcePanel({ encounter, profile }: { encounter: Encounter; profile: StudentProfileSummary }) {
  const { intake, fieldSources } = encounter;
  const onset = formatIsoWallTime(intake.onsetIso);

  return (
    <section aria-labelledby="sources-heading" className="glass rounded-3xl p-5 sm:p-6">
      <h3 id="sources-heading" className="display text-xl">
        Source values
      </h3>
      <p className="mb-2 text-xs leading-5 text-muted-foreground">
        What the student reviewed and shared. “{NOT_REPORTED}” means the student did not answer; it is
        never a negative finding.
      </p>
      <dl className="text-sm">
        <Row label="Patient" source={fieldSources.name}>
          {profile.name}, {profile.age}
        </Row>
        <Row label="Plan" source={fieldSources.plan}>
          {profile.planName} <Badge variant="secondary">{profile.planMockLabel}</Badge>
        </Row>
        <Row label="Instruction languages" source={fieldSources.instructionLanguages}>
          {(encounter.preferredInstructionLanguages ?? profile.instructionLanguages)
            .map((code) => LANGUAGE_NAMES[code] ?? code)
            .join(" and ")}
        </Row>
        <Row label="Cost ceiling" source={fieldSources.costCeiling}>
          {profile.costCeiling === null ? "not set" : `${formatMockDollars(profile.costCeiling)} (fictional)`}
        </Row>
        <Row label="Symptoms" source={fieldSources.symptoms}>
          {intake.symptoms.length > 0 ? intake.symptoms.join(", ") : NOT_REPORTED}
        </Row>
        <Row label="Highest temperature" source={fieldSources.maxTempF}>
          {intake.maxTempF === null ? NOT_REPORTED : `${intake.maxTempF}°F`}
        </Row>
        <Row label="Onset" source={fieldSources.onsetIso}>
          {onset ? `${onset} — ${intake.onsetConfirmed ? "confirmed by the student" : "not confirmed by the student"}` : NOT_REPORTED}
        </Row>
        <Row label="Deadline today" source={fieldSources.deadlineToday}>
          {intake.deadlineToday ?? NOT_REPORTED}
        </Row>
        <Row label="Medications taken" source={fieldSources.medsTaken}>
          {formatReportedList(intake.medsTaken)}
        </Row>
        <Row label="Allergies" source={fieldSources.allergies}>
          {formatReportedList(intake.allergies)}
        </Row>
        {RED_FLAG_DEFINITIONS.map((flag) => {
          const answer = intake.redFlags[flag.key];
          return (
            <Row key={flag.key} label={flag.label} source={fieldSources.redFlags}>
              {answer === true ? "Yes" : answer === false ? "No" : NOT_REPORTED}
            </Row>
          );
        })}
        <Row label="Student's words" source={fieldSources.transcript}>
          {intake.transcript ? `“${intake.transcript}”` : NOT_REPORTED}
        </Row>
      </dl>
    </section>
  );
}
