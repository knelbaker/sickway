"use client";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/client/language-store";
import type { FollowUp } from "@/lib/schemas";

/** Always carries its "Simulated self-report" label; never implies real fulfilment or a health outcome (§7.6). */
export function OutcomeChip({ followUp, localized = false }: { followUp: FollowUp; localized?: boolean }) {
  const translated = useLanguage().t.followUp;
  if (localized) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm" aria-label={translated.chip}>
        <Badge variant="secondary">{translated.chip}</Badge>
        <span>
          {followUp.filled ? translated.pickedUp : translated.notPickedUp} ·{" "}
          {translated.feeling(translated.statuses[followUp.symptomStatus] ?? followUp.symptomStatus)}
        </span>
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm" aria-label="Simulated follow-up outcome">
      <Badge variant="secondary">Simulated self-report</Badge>
      <span>
        {followUp.filled ? "Says they picked it up" : "Says they did not pick it up"} · feeling {followUp.symptomStatus}
      </span>
    </p>
  );
}
