"use client";

import { useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `useReducedMotion` for components that change their markup with the answer.
 * The server cannot know the preference, so it reports false until hydration
 * has finished; after that it is the real value. Without this, a visitor who
 * prefers reduced motion gets a hydration mismatch.
 */
export function useSafeReducedMotion(): boolean {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const reduced = useReducedMotion() ?? false;
  return hydrated && reduced;
}
