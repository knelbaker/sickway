"use client";

import { BriefView } from "@/components/hcp/brief-view";
import { STATUS_LABEL, STATUS_VARIANT } from "@/components/hcp/labels";
import { SourcePanel } from "@/components/hcp/source-panel";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { encounterDetailResponseSchema } from "@/lib/api-contracts";
import { usePolling } from "@/lib/client/use-polling";
import { RED_FLAG_DEFINITIONS } from "@/lib/red-flags";

/** One encounter, polled so status changes such as "packet available" appear without a refresh. */
export function EncounterView({ encounterId, profile }: { encounterId: string; profile: StudentProfileSummary }) {
  const { data: encounter, error } = usePolling(`/api/encounters/${encounterId}`, encounterDetailResponseSchema);

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
    <article aria-labelledby="encounter-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="encounter-heading" className="text-base font-semibold">
          {profile.name}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {error === "unavailable" && (
            <span role="status" className="text-xs text-muted-foreground">
              Reconnecting… showing the last update
            </span>
          )}
          <Badge variant={STATUS_VARIANT[encounter.status]} aria-live="polite">
            {STATUS_LABEL[encounter.status]}
          </Badge>
        </div>
      </div>

      {encounter.status === "emergency" && (
        <Alert variant="destructive">
          <AlertTitle>Emergency branch — routine demo flow bypassed</AlertTitle>
          <AlertDescription>
            <p>
              The student answered yes to: {positive.map((flag) => flag.label).join("; ")}. No brief,
              options, or packet path is offered for this encounter.
            </p>
            <p className="mt-2">Prototype rule execution, not a validated screening result.</p>
          </AlertDescription>
        </Alert>
      )}

      {encounter.status === "needs_review" && (
        <Alert>
          <AlertTitle>Needs review — not an all-clear</AlertTitle>
          <AlertDescription>
            {unanswered.length > 0
              ? `Not answered by the student: ${unanswered.map((flag) => flag.label).join("; ")}.`
              : "The intake contained unexpected or out-of-scenario input."}{" "}
            A packet cannot be attached until this is resolved in a new intake.
          </AlertDescription>
        </Alert>
      )}

      {encounter.sbar && <BriefView sbar={encounter.sbar} />}

      <SourcePanel encounter={encounter} profile={profile} />
    </article>
  );
}
