"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches. Used where a phone needs a
 * different structure, not just different spacing (a table that becomes cards),
 * so that only one set of controls ever exists for keyboards and screen readers.
 * Defaults to `fallback` on the server and where matchMedia is missing.
 */
export function useMediaQuery(query: string, fallback: boolean): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}
