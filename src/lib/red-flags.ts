import { z } from "zod";

/**
 * Red-flag checklist categories as specified in sickway.md §6.3:
 * breathing/chest pain, confusion/fainting, stiff neck/rash,
 * high temperature, dehydration, and sudden severe headache.
 *
 * Prototype fields for synthetic student intake review.
 * Every key must have an explicit Answer (true | false | null).
 */
export const RED_FLAG_KEYS = [
  "breathing_chest_pain",
  "confusion_fainting",
  "stiff_neck_rash",
  "high_temperature",
  "dehydration",
  "sudden_severe_headache",
] as const;

export type RedFlagKey = (typeof RED_FLAG_KEYS)[number];

export interface RedFlagDefinition {
  key: RedFlagKey;
  label: string;
  description: string;
}

export const RED_FLAG_DEFINITIONS: readonly RedFlagDefinition[] = [
  {
    key: "breathing_chest_pain",
    label: "Breathing difficulty or chest pain",
    description: "Shortness of breath, wheezing, or chest tightness / pain",
  },
  {
    key: "confusion_fainting",
    label: "Confusion or fainting",
    description: "Difficulty thinking, sudden dizziness, passing out, or altered mental state",
  },
  {
    key: "stiff_neck_rash",
    label: "Stiff neck or new rash",
    description: "Inability to flex neck to chest, or a sudden unexplained spreading rash",
  },
  {
    key: "high_temperature",
    label: "High temperature / fever",
    description: "Temperature of 103°F (39.4°C) or higher, or persistent unmanaged fever",
  },
  {
    key: "dehydration",
    label: "Dehydration or unable to keep liquids down",
    description: "Unable to keep fluids down for 12+ hours, dark urine, or severe dry mouth",
  },
  {
    key: "sudden_severe_headache",
    label: "Sudden severe headache",
    description: "Sudden onset severe headache or headache accompanied by neurological symptoms",
  },
] as const;

export const RED_FLAG_LABELS: Record<RedFlagKey, string> = {
  breathing_chest_pain: "Breathing difficulty or chest pain",
  confusion_fainting: "Confusion or fainting",
  stiff_neck_rash: "Stiff neck or new rash",
  high_temperature: "High temperature / fever",
  dehydration: "Dehydration or unable to keep liquids down",
  sudden_severe_headache: "Sudden severe headache",
};

/**
 * Answer schema: true | false | null (null = unknown / unanswered)
 */
export const answerSchema = z.boolean().nullable();
export type Answer = z.infer<typeof answerSchema>;

/**
 * Runtime schema for the red-flags checklist.
 * Requires all six checklist keys with a value of true, false, or null (never undefined).
 */
export const redFlagsSchema = z.object({
  breathing_chest_pain: answerSchema,
  confusion_fainting: answerSchema,
  stiff_neck_rash: answerSchema,
  high_temperature: answerSchema,
  dehydration: answerSchema,
  sudden_severe_headache: answerSchema,
});

export type RedFlags = z.infer<typeof redFlagsSchema>;
