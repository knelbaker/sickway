import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai";
import type { ExtractResponse } from "@/lib/api-contracts";

/**
 * Candidate intake fields from the student's free text (sickway.md §6.1, §6.2).
 *
 * Extraction only proposes values for the student to review. It never creates a
 * clinician-visible record, never reads profile fields from the sentence, and
 * leaves anything the student did not say as null.
 */

export const EXTRACT_PROMPT_VERSION = "extract-v2";
export const MAX_INTAKE_TEXT_LENGTH = 2000;
export const OUTSIDE_SCENARIO_MESSAGE =
  "That looks outside this demo scenario. Describe how you feel sick today, using fictional details only.";

const modelSchema = z.object({
  outsideScenario: z.boolean(),
  symptoms: z.array(z.string().trim().min(1)),
  maxTempF: z.number().nullable(),
  onsetPhrase: z.string().trim().min(1).nullable(),
  deadlineToday: z.string().trim().min(1).nullable(),
  medsMentioned: z.array(z.string().trim().min(1)),
});

const SYSTEM_PROMPT = `You extract candidate intake fields from a fictional student's description of feeling sick, for a prototype. The student will review every field.

Rules:
- Use only what the TEXT states. Never infer, guess, or add typical symptoms.
- A field the TEXT does not mention is null (or an empty list). Missing is not negative.
- symptoms: every symptom the TEXT states, as short phrases in the student's own words. A stated fever is a symptom ("fever"); keep the number out of the phrase and put it in maxTempF.
- maxTempF: the highest temperature stated, in Fahrenheit, as a number. null if no number is stated.
- onsetPhrase: the exact words describing when it started (for example "yesterday morning"). Do not convert to a date.
- deadlineToday: an obligation today that the student mentions (for example "exam at 2"). Otherwise null.
- medsMentioned: medications the student says they took. Otherwise an empty list.
- The TEXT may be in English or Spanish. Keep every extracted phrase in the student's own language and words. Never translate, in either direction.
- Do not extract a name, age, insurance, school, or any identifier.
- outsideScenario: true when the TEXT is not a description of feeling unwell (for example a question about parking). Then leave all other fields empty or null.`;

// English and Spanish. "mañana" alone can mean "tomorrow", so morning needs its article or "esta".
const TIME_OF_DAY: [RegExp, number][] = [
  [/\bmorning\b|\b(por|en|de) la mañana\b|\besta mañana\b|\bme despert[eé]\b/, 8],
  [/\bnoon\b|\bmidday\b|\blunch|\bmediod[ií]a\b/, 12],
  [/\bafternoon\b|\b(por|en|de) la tarde\b|\besta tarde\b/, 14],
  [/\bevening\b/, 19],
  [/\bnight\b|\btonight\b|\banoche\b|\b(por|en|de) la noche\b|\besta noche\b/, 22],
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};
const NUMBER = "\\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|una?|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce";

function count(word: string): number | null {
  const value = /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word];
  return value === undefined || !Number.isFinite(value) ? null : value;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * A suggested onset for the review form, derived from the student's phrase and
 * the displayed fixture clock, never from the system clock. It is a suggestion
 * only: the student must confirm or edit it (§3 Setup, §6.1). Returns null for
 * a phrase this demo does not understand or a time after the fixture clock.
 */
export function suggestOnsetIso(phrase: string | null, fixtureClock: string): string | null {
  if (!phrase) return null;
  const clock = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(fixtureClock);
  if (!clock) return null;

  const offset = clock[7] === "Z" ? "+00:00" : clock[7];
  const offsetMinutes = (offset.startsWith("-") ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
  const clockMs = Date.parse(fixtureClock);
  const text = phrase.toLowerCase();

  // Wall-clock arithmetic in the fixture clock's own offset, using UTC fields as plain numbers.
  const toIso = (wallMs: number) => {
    const wall = new Date(wallMs);
    const iso = `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:00${offset}`;
    return Date.parse(iso) <= clockMs ? iso : null;
  };
  const clockWallMs = clockMs + offsetMinutes * 60_000;

  const hoursAgo =
    new RegExp(`\\b(${NUMBER})\\s+hours?\\s+ago\\b`).exec(text) ?? new RegExp(`\\bhace\\s+(${NUMBER})\\s+horas?\\b`).exec(text);
  if (hoursAgo) {
    const hours = count(hoursAgo[1]);
    return hours === null ? null : toIso(clockWallMs - hours * 3_600_000);
  }

  let daysBack: number | null = null;
  const daysAgo =
    new RegExp(`\\b(${NUMBER})\\s+days?\\s+ago\\b`).exec(text) ?? new RegExp(`\\bhace\\s+(${NUMBER})\\s+d[ií]as?\\b`).exec(text);
  if (daysAgo) daysBack = count(daysAgo[1]);
  else if (/\banteayer\b|\bantier\b/.test(text)) daysBack = 2;
  else if (/\blast night\b|\byesterday\b|\banoche\b|\bayer\b/.test(text)) daysBack = 1;
  else if (/\btoday\b|\bthis (morning|afternoon|evening)\b|\btonight\b|\bwoke up\b|\bhoy\b|\besta (mañana|tarde|noche)\b|\bme despert[eé]\b/.test(text)) daysBack = 0;
  if (daysBack === null) return null;

  const hour = TIME_OF_DAY.find(([pattern]) => pattern.test(text))?.[1] ?? 12;
  const day = new Date(clockWallMs - daysBack * 86_400_000);
  return toIso(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0, 0));
}

/** Keeps a temperature only when that number is actually in the student's text. */
function groundedTemperature(value: number | null, text: string): number | null {
  if (value === null || value < 90 || value > 110) return null;
  const stated = text.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return stated.includes(value) ? value : null;
}

export type ExtractResult =
  | { ok: true; response: ExtractResponse }
  | { ok: false; reason: "timeout" | "invalid_output" | "rate_limited" | "provider_error" | "cache_error" };

export async function extractIntake(
  sessionId: string,
  text: string,
  fixtureClock: string,
): Promise<ExtractResult> {
  const transcript = text.trim();
  const result = await generateStructured({
    sessionId,
    schema: modelSchema,
    system: SYSTEM_PROMPT,
    prompt: `TEXT:\n${transcript}`,
    promptVersion: EXTRACT_PROMPT_VERSION,
  });
  if (!result.ok) return { ok: false, reason: result.reason };

  const fields = result.data;
  if (fields.outsideScenario) {
    return {
      ok: true,
      response: { outsideScenario: true, transcript, message: OUTSIDE_SCENARIO_MESSAGE, candidateFields: null },
    };
  }

  return {
    ok: true,
    response: {
      outsideScenario: false,
      transcript,
      candidateFields: {
        symptoms: fields.symptoms,
        maxTempF: groundedTemperature(fields.maxTempF, transcript),
        onsetPhrase: fields.onsetPhrase,
        suggestedOnsetIso: suggestOnsetIso(fields.onsetPhrase, fixtureClock),
        deadlineToday: fields.deadlineToday,
        medsMentioned: fields.medsMentioned,
      },
    },
  };
}
