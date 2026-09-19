"use client";

import { useSyncExternalStore } from "react";

/**
 * Browser-side holder for the demo session token. The token pairs two devices
 * for one synthetic demo run; it is not an account or a credential for real data.
 */

const STORAGE_KEY = "sickday.demoSessionToken";
const SESSION_HEADER = "x-demo-session";
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setSessionToken(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
  notify();
}

export function clearSessionToken(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  notify();
}

/** The part before the signature. Display and cache-key use only; the server never trusts it. */
export function sessionIdFromToken(token: string | null): string | null {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  return separator > 0 ? token.slice(0, separator) : null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab on the same device may start, join, or reset a session.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** `undefined` while rendering on the server, then the stored token or null. */
export function useSessionToken(): string | null | undefined {
  return useSyncExternalStore(subscribe, getSessionToken, () => undefined);
}

/** `fetch` for session-scoped API routes; attaches the pairing token. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getSessionToken();
  if (token) headers.set(SESSION_HEADER, token);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers, cache: "no-store" });
}
