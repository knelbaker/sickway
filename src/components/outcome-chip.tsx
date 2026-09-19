import { Badge } from "@/components/ui/badge";
import type { FollowUp } from "@/lib/schemas";

/** Always carries its "Simulated self-report" label; never implies real fulfilment or a health outcome (§7.6). */
export function OutcomeChip({ followUp }: { followUp: FollowUp }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm" aria-label="Simulated follow-up outcome">
      <Badge variant="secondary">Simulated self-report</Badge>
      <span>
        {followUp.filled ? "Says they picked it up" : "Says they did not pick it up"} · feeling {followUp.symptomStatus}
      </span>
    </p>
  );
}
