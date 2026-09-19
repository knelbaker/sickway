"use client";

import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { apiFetch } from "@/lib/client/session-store";

export const POLL_INTERVAL_MS = 2000;

export type PollState<T> = {
  /** The last good response. Kept while a later request fails, so the screen never blanks. */
  data: T | undefined;
  /** Set while the most recent request failed; cleared by the next success. */
  error: "session" | "not_found" | "unavailable" | null;
  /** When `data` was last refreshed, for a visible "last updated" indicator. */
  updatedAt: number | null;
};

/**
 * Polls a session-scoped GET route every two seconds (sickway.md §4). Polling
 * stops while the tab is hidden and resumes, with an immediate refresh, when it
 * becomes visible again. Pass `null` to poll nothing.
 */
export function usePolling<T>(
  path: string | null,
  schema: z.ZodType<T>,
  intervalMs: number = POLL_INTERVAL_MS,
): PollState<T> {
  const [state, setState] = useState<PollState<T> & { path: string | null }>({
    path,
    data: undefined,
    error: null,
    updatedAt: null,
  });
  const schemaRef = useRef(schema);
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const fail = (error: PollState<T>["error"]) =>
      setState((current) => (current.path === path ? { ...current, error } : { path, data: undefined, error, updatedAt: null }));

    async function refresh() {
      // Never stack requests on a slow connection.
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const response = await apiFetch(path!);
        if (cancelled) return;
        // 409: the session was reset elsewhere; apiFetch has already raised the join prompt.
        if (response.status === 401 || response.status === 409) return fail("session");
        if (response.status === 404) return fail("not_found");
        if (!response.ok) return fail("unavailable");
        const data = schemaRef.current.parse(await response.json());
        if (!cancelled) setState({ path, data, error: null, updatedAt: Date.now() });
      } catch {
        if (!cancelled) fail("unavailable");
      } finally {
        inFlight = false;
      }
    }

    const start = () => {
      if (timer) return;
      void refresh();
      timer = setInterval(refresh, intervalMs);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [path, intervalMs]);

  // A changed path must not show the previous path's data.
  return state.path === path ? state : { data: undefined, error: null, updatedAt: null };
}
