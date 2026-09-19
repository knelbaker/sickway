"use client";

import { cn } from "cn";
import { STATUS_LABEL, STATUS_VARIANT } from "@/components/hcp/labels";
import { PollStatus } from "@/components/poll-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { EncounterQueueItem } from "@/lib/api-contracts";
import type { PollState } from "@/lib/client/use-polling";

function time(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Consented submissions in the paired session only, newest first. */
export function Queue({
  queue,
  selectedId,
  onSelect,
}: {
  queue: PollState<EncounterQueueItem[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const items = queue.data;

  return (
    <section aria-labelledby="queue-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="queue-heading" className="text-base font-semibold">
          Demo queue
        </h2>
        {items && <span className="text-xs text-muted-foreground">{items.length} shared</span>}
      </div>

      {queue.error === "session" && (
        <Alert variant="destructive">
          <AlertTitle>Demo session ended</AlertTitle>
          <AlertDescription>Start or join a demo session again from the home page.</AlertDescription>
        </Alert>
      )}
      <PollStatus poll={queue} />

      {!items && !queue.error && <p className="text-sm text-muted-foreground">Loading queue…</p>}

      {items?.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground">
          No shared intakes yet. An intake appears here only after the student reviews it and gives
          consent.
        </p>
      )}

      {items && items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={item.id === selectedId}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  item.id === selectedId && "border-primary bg-muted",
                  item.status === "emergency" && "border-destructive/60",
                )}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{item.displayName}</span>
                  <span className="text-xs text-muted-foreground">{time(item.createdAt)}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {item.chiefSymptoms.length > 0 ? item.chiefSymptoms.join(", ") : "symptoms not reported"}
                </span>
                <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
