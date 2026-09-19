"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The rendered width of an element, for layouts that depend on the room they
 * actually have and not on the window. It is null until measured, and stays null
 * where ResizeObserver does not exist (tests, very old browsers), so callers
 * need a fallback.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
