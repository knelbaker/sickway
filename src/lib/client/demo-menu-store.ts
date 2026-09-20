"use client";

import { useSyncExternalStore } from "react";

/**
 * The navbar's Demo menu can be opened from elsewhere on the page (the hero and
 * the closing call to action), so its state lives outside any one component.
 * "hover" closes again when the pointer leaves; "pinned" stays until dismissed.
 */
export type DemoMenuState = "closed" | "hover" | "pinned";

let state: DemoMenuState = "closed";
const listeners = new Set<() => void>();

export function setDemoMenu(next: DemoMenuState) {
  if (next === state) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export const openDemoMenu = () => setDemoMenu("pinned");
export const closeDemoMenu = () => setDemoMenu("closed");
export const getDemoMenu = () => state;

export function useDemoMenu(): DemoMenuState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => "closed",
  );
}
