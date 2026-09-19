"use client";

import { useState } from "react";
import { EncounterView } from "@/components/hcp/encounter-view";
import { Queue } from "@/components/hcp/queue";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { encountersQueueResponseSchema } from "@/lib/api-contracts";
import { sessionIdFromToken, useSessionToken } from "@/lib/client/session-store";
import { usePolling } from "@/lib/client/use-polling";

/** Keyed by session so a new or reset session never shows the previous run's selection. */
type WorkspaceProps = { profile: StudentProfileSummary; preparedSpokenScript: string; voiceEnabled?: boolean };

export function ClinicianWorkspace(props: WorkspaceProps) {
  const sessionId = sessionIdFromToken(useSessionToken() ?? null);
  return <SessionWorkspace key={sessionId ?? "unpaired"} {...props} />;
}

function SessionWorkspace({ profile, preparedSpokenScript, voiceEnabled = false }: WorkspaceProps) {
  const queue = usePolling("/api/encounters", encountersQueueResponseSchema);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Only ever show an encounter that is in this session's queue.
  const openId = queue.data?.some((item) => item.id === selectedId) ? selectedId : null;

  return (
    <Card lang="en">
      <CardHeader>
        <CardTitle>
          <h1>Clinician workspace</h1>
        </CardTitle>
        <CardDescription>
          Intakes shared in this demo session. Everything shown is synthetic; the brief supports the
          clinician and does not decide anything.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Queue queue={queue} selectedId={openId} onSelect={setSelectedId} />
        <div className="min-w-0">
          {openId ? (
            <EncounterView
              key={openId}
              encounterId={openId}
              profile={profile}
              preparedSpokenScript={preparedSpokenScript}
              voiceEnabled={voiceEnabled}
            />
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {queue.data && queue.data.length > 0 ? "Open an intake from the queue to see its brief." : "Waiting for a shared intake."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
