"use client";

import { useState } from "react";
import { BriefSourceBadge } from "@/components/brief-source-badge";
import { OutcomeChip } from "@/components/outcome-chip";
import { PollStatus } from "@/components/poll-status";
import { CandidateSummary } from "@/components/student/candidate-summary";
import { ConsentControl } from "@/components/student/consent-control";
import { DescribeStep } from "@/components/student/describe-step";
import { SimulateFollowUp } from "@/components/student/follow-up";
import { ListQuestion, RedFlagChecklist } from "@/components/student/follow-ups";
import { PreparedDemoSummary } from "@/components/student/prepared-demo";
import { ProfileSummary, type StudentProfileSummary } from "@/components/student/profile-summary";
import { ReviewForm } from "@/components/student/review-form";
import { StatusView } from "@/components/student/status-view";
import { toReviewedIntake, useIntakeDraft } from "@/components/student/use-intake-draft";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { encounterDetailResponseSchema, intakeResponseSchema, type IntakeResponse } from "@/lib/api-contracts";
import { apiFetch, sessionIdFromToken, useSessionToken } from "@/lib/client/session-store";
import type { ReviewedIntake } from "@/lib/schemas";
import { usePolling } from "@/lib/client/use-polling";

type Step = "describe" | "followups" | "review" | "prepared";

type FlowProps = { profile: StudentProfileSummary; preparedIntake: ReviewedIntake; voiceEnabled?: boolean };

const SUBMIT_ERRORS: Record<string, string> = {
  consent_required: "Consent is required before anything is shared. Nothing was sent.",
  invalid_intake: "Some answers could not be read. Go back, check them, and try again. Nothing was shared.",
  invalid_session: "This demo session has ended. Start or join a session again from the home page.",
  expired_session: "This demo session has ended. Start or join a session again from the home page.",
};

/** Keyed by session so a new session never shows the previous run's submission. */
function storageKey(sessionId: string) {
  return `sickday.submitted.${sessionId}`;
}

function readSubmitted(sessionId: string | null): IntakeResponse | null {
  if (!sessionId) return null;
  try {
    const parsed = intakeResponseSchema.safeParse(JSON.parse(window.sessionStorage.getItem(storageKey(sessionId)) ?? "null"));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Student intake on `/s`: describe → follow-ups → review and consent → status.
 * Keyed by session, so a new or reset session starts from a clean screen with
 * consent unchecked.
 */
export function StudentFlow(props: FlowProps) {
  const sessionId = sessionIdFromToken(useSessionToken() ?? null);
  return <SessionIntake key={sessionId ?? "unpaired"} sessionId={sessionId} {...props} />;
}

/** Polls the shared encounter so the returned packet appears here without a refresh (§3 Scene 3). */
function SubmittedStatus({ submitted, profile }: { submitted: IntakeResponse; profile: StudentProfileSummary }) {
  const poll = usePolling(`/api/encounters/${submitted.encounterId}`, encounterDetailResponseSchema);
  const encounter = poll.data;

  return (
    <div className="flex flex-col gap-2">
      <StatusView
        status={encounter?.status ?? submitted.status}
        packetId={encounter?.packetId}
        profile={profile}
      />
      {encounter?.followUp && <OutcomeChip followUp={encounter.followUp} />}
      {encounter?.status === "packet_available" && <SimulateFollowUp encounterId={encounter.id} />}
      {encounter?.sbar && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Clinic brief: <BriefSourceBadge source={encounter.sbar.source} />
        </p>
      )}
      <PollStatus poll={poll} />
    </div>
  );
}

function SessionIntake({ sessionId, profile, preparedIntake, voiceEnabled = false }: FlowProps & { sessionId: string | null }) {
  const [draft, dispatch] = useIntakeDraft();
  const [step, setStep] = useState<Step>("describe");
  const [consent, setConsent] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Restores this session's submission after a refresh. Rendered on the client only (SessionGate).
  const [submitted, setSubmitted] = useState<IntakeResponse | null>(() => readSubmitted(sessionId));

  function startOver() {
    dispatch({ type: "reset" });
    setStep("describe");
    setConsent(false);
    setDeclined(false);
    setError(null);
  }

  async function submit() {
    // Never rely on the disabled button alone.
    if (!consent || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch("/api/intake", {
        method: "POST",
        body: JSON.stringify(
          step === "prepared"
            ? { usePreparedDemo: true, consent: { shareWithClinic: true } }
            : { intake: toReviewedIntake(draft), consent: { shareWithClinic: true } },
        ),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = (body as { error?: string } | null)?.error ?? "";
        setError(SUBMIT_ERRORS[code] ?? "Could not reach the demo clinic. Nothing was shared. Try again.");
        return;
      }
      const result = intakeResponseSchema.parse(body);
      if (sessionId) window.sessionStorage.setItem(storageKey(sessionId), JSON.stringify(result));
      setSubmitted(result);
    } catch {
      setError("Could not reach the demo clinic. Nothing was shared. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Student intake</h1>
        </CardTitle>
        <CardDescription>
          Nothing you enter is shared with the demo clinic until you review it and give consent.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ProfileSummary profile={profile} />

        {submitted && <SubmittedStatus submitted={submitted} profile={profile} />}

        {!submitted && step === "describe" && (
          <DescribeStep
            onExtracted={(transcript, fields) => {
              dispatch({ type: "extracted", transcript, fields });
              setStep("followups");
            }}
            onUsePrepared={() => setStep("prepared")}
            voiceEnabled={voiceEnabled}
          />
        )}

        {!submitted && step === "followups" && (
          <>
            <CandidateSummary draft={draft} />
            <RedFlagChecklist
              answers={draft.redFlags}
              notSure={draft.notSure}
              onAnswer={(key, answer) => dispatch({ type: "redFlag", key, answer })}
            />
            <ListQuestion
              number={2}
              legend="Have you taken any medications for this?"
              inputLabel="Which medications?"
              placeholder="For example: ibuprofen"
              value={draft.medsTaken}
              onChange={(value) => dispatch({ type: "set", field: "medsTaken", value })}
            />
            <ListQuestion
              number={3}
              legend="Do you have any allergies?"
              inputLabel="Which allergies?"
              placeholder="For example: penicillin"
              value={draft.allergies}
              onChange={(value) => dispatch({ type: "set", field: "allergies", value })}
            />
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button type="button" className="h-11" onClick={() => setStep("review")}>
                Continue to review
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={startOver}>
                Start over
              </Button>
            </div>
          </>
        )}

        {!submitted && step === "prepared" && (
          <>
            <PreparedDemoSummary intake={preparedIntake} />
            <ConsentControl
              consent={consent}
              pending={pending}
              onConsentChange={(next) => {
                setConsent(next);
                setDeclined(false);
              }}
              onSubmit={submit}
              onDecline={() => {
                setConsent(false);
                setDeclined(true);
                setError(null);
              }}
            />
            {declined && (
              <Alert aria-live="polite">
                <AlertTitle>Not shared</AlertTitle>
                <AlertDescription>
                  The prepared case stays on this screen. The demo clinic cannot see it and nothing was sent.
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" aria-live="assertive">
                <AlertTitle>Not shared</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={startOver}>
                Back to typing my own
              </Button>
            </div>
          </>
        )}

        {!submitted && step === "review" && (
          <>
            <ReviewForm
              draft={draft}
              dispatch={dispatch}
              profile={profile}
              onEditAnswers={() => setStep("followups")}
            />
            <ConsentControl
              consent={consent}
              pending={pending}
              onConsentChange={(next) => {
                setConsent(next);
                setDeclined(false);
              }}
              onSubmit={submit}
              onDecline={() => {
                setConsent(false);
                setDeclined(true);
                setError(null);
              }}
            />
            {declined && (
              <Alert aria-live="polite">
                <AlertTitle>Not shared</AlertTitle>
                <AlertDescription>
                  Your intake stays on this screen. The demo clinic cannot see it and nothing was sent.
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" aria-live="assertive">
                <AlertTitle>Not shared</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={startOver}>
                Start over
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
