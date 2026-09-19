"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/client/language-store";
import type { PollState } from "@/lib/client/use-polling";

const STALE_AFTER_MS = 6000;

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

/**
 * One consistent indicator for every polled view (sickway.md §15 "two devices
 * show stale state"): live, reconnecting, or stale, always with the time of the
 * last successful update, so nobody mistakes an old screen for the current one.
 */
export function PollStatus({ poll, localized = false }: { poll: Pick<PollState<unknown>, "error" | "updatedAt">; localized?: boolean }) {
  const translated = useLanguage().t.poll;
  // The clinician workspace stays in English; student-facing views pass `localized`.
  const text = localized
    ? translated
    : { reconnecting: "Reconnecting…", live: (time: string) => `Live · updated ${time}`, stale: (time: string) => `Reconnecting… showing data from ${time}` };
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (poll.error === "session" || poll.error === "not_found") return null;
  if (poll.updatedAt === null) {
    return poll.error ? (
      <p role="status" className="text-xs text-muted-foreground">
        {text.reconnecting}
      </p>
    ) : null;
  }

  const stale = poll.error === "unavailable" || now - poll.updatedAt > STALE_AFTER_MS;
  return (
    <p role="status" className={stale ? "text-xs font-medium text-amber-700" : "text-xs text-muted-foreground"}>
      {stale ? text.stale(clock(poll.updatedAt)) : text.live(clock(poll.updatedAt))}
    </p>
  );
}
