"use client";

import { useSyncExternalStore } from "react";
import { getSessionToken, sessionIdFromToken, subscribeToSession } from "@/lib/client/session-store";
import { MESSAGES, type Language, type Messages } from "@/lib/i18n/messages";

/**
 * The interface language for this device (issue #61). The choice is scoped to
 * the active demo session: it survives navigation and refresh, and a reset,
 * which starts a new session, does not reuse it. Before a device is paired the
 * choice is kept under "unpaired" and carried into the session that device
 * starts or joins, because the person just chose it on the entry screen.
 *
 * Changing language only re-renders text. It never touches a draft, an answer,
 * or consent, which live in component state elsewhere.
 */

const PREFIX = "sickday.language.";
const UNPAIRED = "unpaired";
const listeners = new Set<() => void>();

function key(): string {
  return PREFIX + (sessionIdFromToken(getSessionToken()) ?? UNPAIRED);
}

function read(storageKey: string): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(storageKey) === "es" ? "es" : "en";
}

export function getLanguage(): Language {
  return read(key());
}

export function setLanguage(language: Language): void {
  window.localStorage.setItem(key(), language);
  for (const listener of listeners) listener();
}

/** Call right after this device starts or joins a session, with the language shown on the entry screen. */
export function carryLanguageIntoSession(language: Language): void {
  setLanguage(language);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // A new or reset session changes which preference applies.
  const unsubscribeSession = subscribeToSession(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeSession();
  };
}

export function useLanguage(): { language: Language; t: Messages; setLanguage: (language: Language) => void } {
  const language = useSyncExternalStore(subscribe, getLanguage, () => "en" as Language);
  return { language, t: MESSAGES[language], setLanguage };
}
