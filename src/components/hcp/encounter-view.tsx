"use client";

import { BriefAudio } from "@/components/hcp/brief-audio";
import { BriefView } from "@/components/hcp/brief-view";
import { STATUS_VARIANT } from "@/components/hcp/labels";
import { SourcePanel } from "@/components/hcp/source-panel";
import { OutcomeChip } from "@/components/outcome-chip";
import { PollStatus } from "@/components/poll-status";
import { VisitPanel } from "@/components/hcp/visit-panel";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { encounterDetailResponseSchema } from "@/lib/api-contracts";
import { useLanguage } from "@/lib/client/language-store";
import { usePolling } from "@/lib/client/use-polling";
import { RED_FLAG_DEFINITIONS } from "@/lib/red-flags";

/** One encounter, polled so status changes such as "packet available" appear without a refresh. */
export function EncounterView({
  encounterId,
  profile,
  preparedSpokenScript,
  voiceEnabled = false,
}: {
  encounterId: string;
  profile: StudentProfileSummary;
  preparedSpokenScript: string;
  voiceEnabled?: boolean;
}) {
  const { t } = useLanguage();
  const c = t.clinician;
  const e = c.encounter;
  const poll = usePolling(`/api/encounters/${encounterId}`, encounterDetailResponseSchema);
  const { data: encounter, error } = poll;
  const flagNames = (flags: typeof RED_FLAG_DEFINITIONS) => flags.map((flag) => t.followUps.redFlags[flag.key].label).join("; ");

  if (!encounter) {
    if (error === "not_found") {
      return <p className="text-sm text-muted-foreground">{e.notInSession}</p>;
    }
    if (error === "session") return null; // the queue already explains an ended session
    return <p className="text-sm text-muted-foreground">{error ? e.reconnecting : e.loading}</p>;
  }

  const unanswered = RED_FLAG_DEFINITIONS.filter((flag) => encounter.intake.redFlags[flag.key] === null);
  const positive = RED_FLAG_DEFINITIONS.filter((flag) => encounter.intake.redFlags[flag.key] === true);

  return (
    <article aria-labelledby="encounter-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="encounter-heading" className="display text-3xl">
          {profile.name}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <PollStatus poll={poll} localized />
          <Badge variant={STATUS_VARIANT[encounter.status]} aria-live="polite">
            {c.status[encounter.status]}
          </Badge>
        </div>
      </div>

      {encounter.followUp && <OutcomeChip followUp={encounter.followUp} localized />}

      {encounter.status === "emergency" && (
        <Alert variant="destructive">
          <AlertTitle>{e.emergencyTitle}</AlertTitle>
          <AlertDescription>
            <p>{e.emergencyBody(flagNames(positive))}</p>
            <p className="mt-2">{e.emergencyNote}</p>
          </AlertDescription>
        </Alert>
      )}

      {encounter.status === "needs_review" && (
        <Alert>
          <AlertTitle>{e.reviewTitle}</AlertTitle>
          <AlertDescription>
            {unanswered.length > 0 ? e.reviewUnanswered(flagNames(unanswered)) : e.reviewUnexpected} {e.reviewTail}
          </AlertDescription>
        </Alert>
      )}

      {encounter.sbar && (
        <BriefView sbar={encounter.sbar}>
          <BriefAudio script={encounter.sbar.spokenScript} preparedScript={preparedSpokenScript} />
        </BriefView>
      )}

      {/* The emergency branch bypasses the routine flow: no options or packet path at all. */}
      {encounter.status !== "emergency" && (
        <VisitPanel
          encounter={encounter}
          costCeiling={profile.costCeiling}
          preferredLanguages={encounter.preferredInstructionLanguages ?? profile.instructionLanguages}
          preferenceSource={encounter.preferredInstructionLanguages ? "student" : "profile"}
          voiceEnabled={voiceEnabled}
        />
      )}

      <SourcePanel encounter={encounter} profile={profile} />
    </article>
  );
}
