"use client";

import { useState } from "react";
import { EncounterView } from "@/components/hcp/encounter-view";
import { Queue } from "@/components/hcp/queue";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
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
    // The workspace is the page, not a box on it, and on a wide screen it takes the margins too:
    // a clinician reads a brief and compares options side by side, and both want room.
    <div lang="en" className="page-bleed flex flex-col gap-8 lg:-mx-[var(--bleed)]">
      <header>
        <h1 className="text-4xl sm:text-5xl">Clinician workspace</h1>
        <p className="mt-3 max-w-[70ch] leading-7 text-ink-soft">
          Intakes shared in this demo session. Everything shown is synthetic; the brief supports the
          clinician and does not decide anything.
        </p>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-8">
        <div className="glass rounded-3xl p-4 sm:p-5 md:sticky md:top-40">
          <Queue queue={queue} selectedId={openId} onSelect={setSelectedId} />
        </div>
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
            <p className="rounded-3xl border-2 border-dashed border-ink/20 p-8 text-center leading-7 text-ink-soft">
              {queue.data && queue.data.length > 0 ? "Open an intake from the queue to see its brief." : "Waiting for a shared intake."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
