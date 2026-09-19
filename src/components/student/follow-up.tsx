"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/session-store";

const CHOICES = [
  { label: "Picked it up · feeling better", filled: true, symptomStatus: "improving" },
  { label: "Picked it up · about the same", filled: true, symptomStatus: "about the same" },
  { label: "Did not pick it up · feeling worse", filled: false, symptomStatus: "worse" },
];

/** Two taps: open, then choose. The result shows up as the outcome chip on the next poll. */
export function SimulateFollowUp({ encounterId }: { encounterId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function record(choice: (typeof CHOICES)[number]) {
    setPending(true);
    setFailed(false);
    try {
      const response = await apiFetch(`/api/encounters/${encounterId}/followup`, {
        method: "POST",
        body: JSON.stringify({ simulated: true, filled: choice.filled, symptomStatus: choice.symptomStatus }),
      });
      if (!response.ok) throw new Error();
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div>
        <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(true)}>
          Simulate follow-up
        </Button>
      </div>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Simulated follow-up — pick a pretend answer</legend>
      <p className="text-xs leading-5 text-muted-foreground">
        A made-up self-report for the demo. It does not check a pharmacy and says nothing about real health.
      </p>
      {CHOICES.map((choice) => (
        <Button key={choice.label} type="button" variant="outline" className="h-11 justify-start" disabled={pending} onClick={() => void record(choice)}>
          {choice.label}
        </Button>
      ))}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Could not record that. Nothing was changed. Try again.
        </p>
      )}
    </fieldset>
  );
}
