import { z } from "zod";
import { RED_FLAG_KEYS, redFlagsSchema } from "@/lib/red-flags";
import { reviewedIntakeSchema, type ReviewedIntake } from "@/lib/schemas";

const routingIntakeSchema = reviewedIntakeSchema.extend({
  redFlags: redFlagsSchema.strict(),
  outsideScenario: z.boolean().optional(),
}).strict();

const timestampSchema = z.iso.datetime({ offset: true });

export type DemoRoutingResult = {
  branch: "emergency" | "needs_review" | "ready";
  reasons: string[];
};

export type ElapsedSymptomTime = {
  hours: number;
  onsetIso: string;
  fixtureClock: string;
  source: { onsetIso: "student_review"; fixtureClock: "demo_fixture" };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Demo routing result from a reviewed intake with an optional outsideScenario
 * boolean. Accepts unknown input so malformed payloads produce explicit review
 * reasons. Pure rule execution, not clinically validated triage or diagnosis.
 */
export function routeIntake(intake: unknown): DemoRoutingResult {
  const input = isRecord(intake) ? intake : {};
  const redFlags = isRecord(input.redFlags) ? input.redFlags : {};
  const positiveFlags = RED_FLAG_KEYS.filter((key) => redFlags[key] === true);

  // An explicit positive takes precedence even when other fields are malformed.
  if (positiveFlags.length > 0) {
    return {
      branch: "emergency",
      reasons: positiveFlags.map((key) => `Positive demo checklist item: ${key}.`),
    };
  }

  const reasons: string[] = [];
  if (input.outsideScenario === true) {
    reasons.push("Outside this demo scenario (outsideScenario).");
  }

  const parsed = routingIntakeSchema.safeParse(intake);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      reasons.push(
        `Unexpected input at ${issue.path.join(".") || "intake"}: ${issue.message}`,
      );
    }
  }

  for (const key of RED_FLAG_KEYS) {
    if (redFlags[key] === null) {
      reasons.push(`Unanswered demo checklist item: ${key}.`);
    }
  }

  return { branch: reasons.length > 0 ? "needs_review" : "ready", reasons };
}

/**
 * Elapsed hours from the explicitly reviewed onset to the displayed fixture
 * clock, with both sources. Missing, ambiguous, or reversed times return null.
 * The current system time is never used.
 */
export function elapsedSinceOnset(
  intake: ReviewedIntake,
  fixtureClock: string,
): ElapsedSymptomTime | null {
  if (intake.onsetConfirmed !== true) return null;

  const onset = timestampSchema.safeParse(intake.onsetIso);
  const clock = timestampSchema.safeParse(fixtureClock);
  if (!onset.success || !clock.success) return null;

  const hours = (Date.parse(clock.data) - Date.parse(onset.data)) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;

  return {
    hours,
    onsetIso: onset.data,
    fixtureClock: clock.data,
    source: { onsetIso: "student_review", fixtureClock: "demo_fixture" },
  };
}
