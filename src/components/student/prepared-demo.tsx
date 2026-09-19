"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatIsoWallTime, formatReportedList, NOT_REPORTED } from "@/lib/format";
import { RED_FLAG_DEFINITIONS } from "@/lib/red-flags";
import type { ReviewedIntake } from "@/lib/schemas";

/**
 * The scripted Scene 1 case, shown exactly as it will be shared. Choosing it is
 * an explicit action; it is never substituted for what someone typed (§4.1).
 * Consent is still separate and unticked.
 */
export function PreparedDemoSummary({ intake }: { intake: ReviewedIntake }) {
  return (
    <section aria-labelledby="prepared-heading" className="flex flex-col gap-3">
      <Alert>
        <AlertTitle id="prepared-heading" className="flex flex-wrap items-center gap-2">
          Prepared demo case <Badge variant="secondary">Prepared fixture output</Badge>
        </AlertTitle>
        <AlertDescription>
          These are scripted answers from the demo fixture, not yours. The clinic&apos;s brief and
          audio for this case are also prepared in advance and will be labelled that way.
        </AlertDescription>
      </Alert>
      <dl className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
        {[
          ["Words", `“${intake.transcript}”`],
          ["Symptoms", intake.symptoms.join(", ") || NOT_REPORTED],
          ["Highest temperature", intake.maxTempF === null ? NOT_REPORTED : `${intake.maxTempF}°F`],
          ["Onset", `${formatIsoWallTime(intake.onsetIso) ?? NOT_REPORTED}${intake.onsetConfirmed ? " — confirmed in the script" : ""}`],
          ["Deadline today", intake.deadlineToday ?? NOT_REPORTED],
          ["Medications taken", formatReportedList(intake.medsTaken)],
          ["Allergies", formatReportedList(intake.allergies)],
          ...RED_FLAG_DEFINITIONS.map((flag) => {
            const answer = intake.redFlags[flag.key];
            return [flag.label, answer === true ? "Yes" : answer === false ? "No (scripted)" : NOT_REPORTED];
          }),
        ].map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-x-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right font-medium">
              {value} <Badge variant="outline" className="shrink-0 font-normal">demo fixture</Badge>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
