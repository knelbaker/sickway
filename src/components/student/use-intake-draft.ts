"use client";

import { useReducer } from "react";
import type { CandidateIntakeFields } from "@/lib/api-contracts";
import { RED_FLAG_KEYS, type Answer, type RedFlagKey } from "@/lib/red-flags";

/**
 * The student's intake while it is still on their own screen. It lives in
 * memory only: nothing here reaches the clinic until the student reviews it and
 * gives consent (sickway.md §6.2, §8).
 */
export type IntakeDraft = {
  transcript: string;
  /** False when extraction failed and the student is entering fields by hand. */
  extracted: boolean;
  symptoms: string[];
  maxTempF: number | null;
  onsetPhrase: string | null;
  onsetIso: string | null;
  onsetConfirmed: boolean;
  deadlineToday: string | null;
  /** [] = explicitly none; null = unanswered. */
  medsTaken: string[] | null;
  allergies: string[] | null;
  /** Untouched and "Not sure" are both null. Never defaulted to false. */
  redFlags: Record<RedFlagKey, Answer>;
};

export type DraftAction =
  | { type: "extracted"; transcript: string; fields: CandidateIntakeFields | null }
  | { type: "redFlag"; key: RedFlagKey; answer: Answer }
  | { type: "set"; field: "medsTaken" | "allergies"; value: string[] | null }
  | { type: "reset" };

function unanswered(): Record<RedFlagKey, Answer> {
  return Object.fromEntries(RED_FLAG_KEYS.map((key) => [key, null])) as Record<RedFlagKey, Answer>;
}

export function emptyDraft(): IntakeDraft {
  return {
    transcript: "",
    extracted: false,
    symptoms: [],
    maxTempF: null,
    onsetPhrase: null,
    onsetIso: null,
    onsetConfirmed: false,
    deadlineToday: null,
    medsTaken: null,
    allergies: null,
    redFlags: unanswered(),
  };
}

export function draftReducer(draft: IntakeDraft, action: DraftAction): IntakeDraft {
  switch (action.type) {
    case "extracted": {
      const fields = action.fields;
      return {
        ...emptyDraft(),
        transcript: action.transcript,
        extracted: fields !== null,
        symptoms: fields?.symptoms ?? [],
        maxTempF: fields?.maxTempF ?? null,
        onsetPhrase: fields?.onsetPhrase ?? null,
        // A suggestion only; it stays unconfirmed until the student confirms it in review.
        onsetIso: fields?.suggestedOnsetIso ?? null,
        onsetConfirmed: false,
        deadlineToday: fields?.deadlineToday ?? null,
        // The student named these themselves; they still review them.
        medsTaken: fields && fields.medsMentioned.length > 0 ? fields.medsMentioned : null,
      };
    }
    case "redFlag":
      return { ...draft, redFlags: { ...draft.redFlags, [action.key]: action.answer } };
    case "set":
      return { ...draft, [action.field]: action.value };
    case "reset":
      return emptyDraft();
  }
}

export function useIntakeDraft() {
  return useReducer(draftReducer, undefined, emptyDraft);
}
