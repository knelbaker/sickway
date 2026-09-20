"use client";

import { BriefAudio } from "@/components/hcp/brief-audio";
import { BriefView } from "@/components/hcp/brief-view";
import { STATUS_LABEL, STATUS_VARIANT } from "@/components/hcp/labels";
import { SourcePanel } from "@/components/hcp/source-panel";
import { OutcomeChip } from "@/components/outcome-chip";
import { PollStatus } from "@/components/poll-status";
import { VisitPanel } from "@/components/hcp/visit-panel";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { encounterDetailResponseSchema } from "@/lib/api-contracts";
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
  const poll = usePolling(`/api/encounters/${encounterId}`, encounterDetailResponseSchema);
  const { data: encounter, error } = poll;

  if (!encounter) {
    if (error === "not_found") {
      return <p className="text-sm text-muted-foreground">This encounter is not in the current demo session.</p>;
    }
    if (error === "session") return null; // the queue already explains an ended session
    return <p className="text-sm text-muted-foreground">{error ? "Reconnecting…" : "Loading encounter…"}</p>;
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
          <PollStatus poll={poll} />
          <Badge variant={STATUS_VARIANT[encounter.status]} aria-live="polite">
            {STATUS_LABEL[encounter.status]}
          </Badge>
        </div>
      </div>

      {encounter.followUp && <OutcomeChip followUp={encounter.followUp} />}

      {(positive.length > 0 || encounter.status === "emergency") && (
        <Alert variant="destructive">
          <AlertTitle>Emergency checklist flagged — synthetic demo</AlertTitle>
          <AlertDescription>
            <p>
              The student answered yes to: {positive.map((flag) => flag.label).join("; ")}. Review
              the SBAR and source values below. You can continue with mock options and a demo packet;
              these fixture choices are not treatment recommendations for the reported symptoms.
            </p>
            <p className="mt-2">Prototype rule execution, not a validated screening result.</p>
          </AlertDescription>
        </Alert>
      )}

      {(unanswered.length > 0 || encounter.status === "needs_review") && (
        <Alert>
          <AlertTitle>Needs review — not an all-clear</AlertTitle>
          <AlertDescription>
            {unanswered.length > 0
              ? `Not answered by the student: ${unanswered.map((flag) => flag.label).join("; ")}.`
              : "The intake contained unexpected or out-of-scenario input."}{" "}
            You can continue with mock options and a demo packet. Creating a packet does not resolve these unanswered items.
          </AlertDescription>
        </Alert>
      )}

      {encounter.sbar && (
        <BriefView sbar={encounter.sbar}>
          <BriefAudio script={encounter.sbar.spokenScript} preparedScript={preparedSpokenScript} />
        </BriefView>
      )}

      <VisitPanel
        encounter={encounter}
        costCeiling={profile.costCeiling}
        preferredLanguages={encounter.preferredInstructionLanguages ?? profile.instructionLanguages}
        preferenceSource={encounter.preferredInstructionLanguages ? "student" : "profile"}
        voiceEnabled={voiceEnabled}
      />

      <SourcePanel encounter={encounter} profile={profile} />
    </article>
  );
}
