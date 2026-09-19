"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/client/language-store";
import { apiFetch } from "@/lib/client/session-store";

// Values sent to the server stay fixed; only the labels come from the language catalogue.
const CHOICES = [
  { filled: true, symptomStatus: "improving" },
  { filled: true, symptomStatus: "about the same" },
  { filled: false, symptomStatus: "worse" },
];

/** Two taps: open, then choose. The result shows up as the outcome chip on the next poll. */
export function SimulateFollowUp({ encounterId }: { encounterId: string }) {
  const { t } = useLanguage();
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
          {t.followUp.button}
        </Button>
      </div>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{t.followUp.legend}</legend>
      <p className="text-xs leading-5 text-muted-foreground">
        {t.followUp.note}
      </p>
      {CHOICES.map((choice, index) => (
        <Button key={choice.symptomStatus} type="button" variant="outline" className="h-11 justify-start" disabled={pending} onClick={() => void record(choice)}>
          {t.followUp.choices[index]}
        </Button>
      ))}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t.followUp.failed}
        </p>
      )}
    </fieldset>
  );
}
