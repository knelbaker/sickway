"use client";

import { cn } from "cn";
import { STATUS_VARIANT } from "@/components/hcp/labels";
import { PollStatus } from "@/components/poll-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import type { EncounterQueueItem } from "@/lib/api-contracts";
import { useLanguage } from "@/lib/client/language-store";
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
  const { t } = useLanguage();
  const c = t.clinician;
  const items = queue.data;

  return (
    <section aria-labelledby="queue-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="queue-heading" className="display text-xl">
          {c.queue.title}
        </h2>
        {items && (
          <span className="text-xs text-muted-foreground">
            <AnimatedCounter value={items.length} /> {c.queue.shared}
          </span>
        )}
      </div>

      {queue.error === "session" && (
        <Alert variant="destructive">
          <AlertTitle>{c.sessionEndedTitle}</AlertTitle>
          <AlertDescription>{c.sessionEndedBody}</AlertDescription>
        </Alert>
      )}
      <PollStatus poll={queue} localized />

      {!items && !queue.error && <p className="text-sm text-muted-foreground">{c.queue.loading}</p>}

      {items?.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground">
          {c.queue.empty}
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
                  "relative flex w-full cursor-pointer flex-col gap-1.5 overflow-hidden rounded-2xl border border-ink/12 bg-paper/70 p-3.5 pl-5 text-left outline-none transition-colors duration-200 hover:border-ink/40 focus-visible:ring-3 focus-visible:ring-ring/50",
                  // The open intake carries the one red line.
                  item.id === selectedId && "border-ink bg-paper before:absolute before:inset-y-3 before:left-2 before:w-[3px] before:rounded-full before:bg-brand-red",
                  item.status === "emergency" && "border-destructive/60",
                )}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{item.displayName}</span>
                  <span className="text-xs text-muted-foreground">{time(item.createdAt)}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {item.chiefSymptoms.length > 0 ? item.chiefSymptoms.join(", ") : c.queue.noSymptoms}
                </span>
                <Badge variant={STATUS_VARIANT[item.status]}>{c.status[item.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
