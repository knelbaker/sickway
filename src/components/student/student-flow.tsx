"use client";

import { useState } from "react";
import { CandidateSummary } from "@/components/student/candidate-summary";
import { DescribeStep } from "@/components/student/describe-step";
import { ListQuestion, RedFlagChecklist } from "@/components/student/follow-ups";
import { ProfileSummary, type StudentProfileSummary } from "@/components/student/profile-summary";
import { useIntakeDraft } from "@/components/student/use-intake-draft";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Step = "describe" | "followups";

/** Student intake on `/s`: describe, then three follow-up groups. The draft stays on this device. */
export function StudentFlow({ profile }: { profile: StudentProfileSummary }) {
  const [draft, dispatch] = useIntakeDraft();
  const [step, setStep] = useState<Step>("describe");

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

        {step === "describe" && (
          <DescribeStep
            onExtracted={(transcript, fields) => {
              dispatch({ type: "extracted", transcript, fields });
              setStep("followups");
            }}
          />
        )}

        {step === "followups" && (
          <>
            <CandidateSummary draft={draft} />
            <RedFlagChecklist onAnswer={(key, answer) => dispatch({ type: "redFlag", key, answer })} />
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
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => {
                  dispatch({ type: "reset" });
                  setStep("describe");
                }}
              >
                Start over
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
