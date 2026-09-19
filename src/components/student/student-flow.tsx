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
import { StepThread } from "@/components/student/step-thread";
import { toReviewedIntake, useIntakeDraft } from "@/components/student/use-intake-draft";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { encounterDetailResponseSchema, intakeResponseSchema, type IntakeResponse } from "@/lib/api-contracts";
import { useLanguage } from "@/lib/client/language-store";
import { apiFetch, sessionIdFromToken, useSessionToken } from "@/lib/client/session-store";
import type { InstructionLanguage, ReviewedIntake } from "@/lib/schemas";
import { usePolling } from "@/lib/client/use-polling";

type Step = "describe" | "followups" | "review" | "prepared";

type FlowProps = { profile: StudentProfileSummary; preparedIntake: ReviewedIntake; voiceEnabled?: boolean };

/** Server error codes → which reviewed message to show. The text itself comes from the language catalogue. */
const SUBMIT_ERROR_KEYS: Record<string, "consent_required" | "invalid_intake" | "session"> = {
  consent_required: "consent_required",
  invalid_intake: "invalid_intake",
  invalid_session: "session",
  expired_session: "session",
  session_superseded: "session",
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
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2">
      <StatusView
        status={encounter?.status ?? submitted.status}
        packetId={encounter?.packetId}
        profile={profile}
      />
      {encounter?.followUp && <OutcomeChip followUp={encounter.followUp} localized />}
      {encounter?.status === "packet_available" && <SimulateFollowUp encounterId={encounter.id} />}
      {encounter?.sbar && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t.flow.clinicBrief} <BriefSourceBadge source={encounter.sbar.source} localized />
        </p>
      )}
      <PollStatus poll={poll} localized />
    </div>
  );
}

function SessionIntake({ sessionId, profile, preparedIntake, voiceEnabled = false }: FlowProps & { sessionId: string | null }) {
  const { language, t } = useLanguage();
  const [draft, dispatch] = useIntakeDraft();
  // The student's own instruction-language preference. It starts from the displayed profile
  // selection and is independent of the interface language: nothing is inferred from that choice.
  const [preferredLanguages, setPreferredLanguages] = useState<InstructionLanguage[]>(
    profile.instructionLanguages.filter((code): code is InstructionLanguage => code === "en" || code === "es"),
  );
  const [step, setStep] = useState<Step>("describe");
  const [consent, setConsent] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [pending, setPending] = useState(false);
  // A key, not text, so an error message follows a language switch like everything else.
  const [error, setError] = useState<keyof typeof t.flow.errors | null>(null);
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
    if (!consent || pending || preferredLanguages.length === 0) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch("/api/intake", {
        method: "POST",
        body: JSON.stringify(
          step === "prepared"
            ? { usePreparedDemo: true, consent: { shareWithClinic: true } }
            : {
                intake: toReviewedIntake(draft),
                preferredInstructionLanguages: preferredLanguages,
                consent: { shareWithClinic: true },
              },
        ),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = (body as { error?: string } | null)?.error ?? "";
        setError(SUBMIT_ERROR_KEYS[code] ?? "generic");
        return;
      }
      const result = intakeResponseSchema.parse(body);
      if (sessionId) window.sessionStorage.setItem(storageKey(sessionId), JSON.stringify(result));
      setSubmitted(result);
    } catch {
      setError("generic");
    } finally {
      setPending(false);
    }
  }

  const currentStep = submitted ? 3 : step === "describe" ? 0 : step === "followups" ? 1 : 2;

  return (
    <Card lang={language} className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          <h1>{t.flow.title}</h1>
        </CardTitle>
        <CardDescription>
          {t.flow.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-7">
        <StepThread steps={t.flow.steps} current={currentStep} label={t.flow.stepsLabel} />
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
              legend={t.flow.medsLegend}
              inputLabel={t.flow.medsInput}
              placeholder={t.flow.medsPlaceholder}
              value={draft.medsTaken}
              onChange={(value) => dispatch({ type: "set", field: "medsTaken", value })}
            />
            <ListQuestion
              number={3}
              legend={t.flow.allergiesLegend}
              inputLabel={t.flow.allergiesInput}
              placeholder={t.flow.allergiesPlaceholder}
              value={draft.allergies}
              onChange={(value) => dispatch({ type: "set", field: "allergies", value })}
            />
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button type="button" variant="brand" className="h-11" onClick={() => setStep("review")}>
                {t.flow.continueToReview}
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={startOver}>
                {t.flow.startOver}
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
                <AlertTitle>{t.flow.notSharedTitle}</AlertTitle>
                <AlertDescription>
                  {t.flow.declinedPrepared}
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" aria-live="assertive">
                <AlertTitle>{t.flow.notSharedTitle}</AlertTitle>
                <AlertDescription>{t.flow.errors[error]}</AlertDescription>
              </Alert>
            )}
            <div>
              <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={startOver}>
                {t.flow.backToTyping}
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
              preferredLanguages={preferredLanguages}
              onPreferredLanguagesChange={setPreferredLanguages}
              onEditAnswers={() => setStep("followups")}
            />
            <ConsentControl
              consent={consent}
              pending={pending}
              canSubmit={preferredLanguages.length > 0}
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
                <AlertTitle>{t.flow.notSharedTitle}</AlertTitle>
                <AlertDescription>
                  {t.flow.declined}
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" aria-live="assertive">
                <AlertTitle>{t.flow.notSharedTitle}</AlertTitle>
                <AlertDescription>{t.flow.errors[error]}</AlertDescription>
              </Alert>
            )}
            <div>
              <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={startOver}>
                {t.flow.startOver}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
