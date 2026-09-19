import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai";
import { type DemoRoutingResult, elapsedSinceOnset } from "@/lib/demo-routing";
import { fixtures, type Fixtures } from "@/lib/fixtures";
import { RED_FLAG_KEYS, RED_FLAG_LABELS } from "@/lib/red-flags";
import type { ReviewedIntake, Sbar } from "@/lib/schemas";

/**
 * Clinician brief (sickway.md §7.2). Three sources, always labelled:
 * - generated: drafted by the model from the reviewed facts below
 * - deterministic: assembled from the same facts when generation fails
 * - prepared_fixture: the seeded case, only on an explicit caller request
 *
 * No path may diagnose, recommend a drug, invent a negative finding, mention
 * a therapy or manufacturer, or claim that coverage was verified.
 */

export const SBAR_PROMPT_VERSION = "sbar-v1";

type Profile = Fixtures["profile"];

const NOT_REPORTED = "not reported";

const generatedSchema = z.object({
  situation: z.string().trim().min(1),
  background: z.string().trim().min(1),
  assessment: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
  spokenScript: z.string().trim().min(1),
});

const BRANCH_LABEL: Record<DemoRoutingResult["branch"], string> = {
  ready: "routine campus clinic demo",
  needs_review: "needs review before continuing",
  emergency: "emergency branch — routine demo flow bypassed",
};

const RECOMMENDATION: Record<DemoRoutingResult["branch"], string> = {
  ready: "Review the synthetic intake with the demo clinic. Booking is not connected.",
  needs_review:
    "Review the unanswered or unexpected items with the student before continuing. Booking is not connected.",
  emergency:
    "A demo checklist item was answered yes, so the routine demo flow is bypassed. This prototype message is not a validated screening result.",
};

function list(values: string[]): string {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

/** [] means explicitly none; null means the student did not answer. */
function reportedList(values: string[] | null): string {
  if (values === null) return NOT_REPORTED;
  return values.length === 0 ? "none reported" : list(values);
}

function hoursText(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} hour${rounded === 1 ? "" : "s"}`;
}

/** The reviewed facts, with every gap already rendered as "not reported". */
export function sbarFacts(intake: ReviewedIntake, profile: Profile, routing: DemoRoutingResult) {
  const plan = fixtures.plans.find((row) => row.id === profile.planId);
  const elapsed = elapsedSinceOnset(intake, profile.fixtureClock);
  const flags = (answer: boolean | null) =>
    RED_FLAG_KEYS.filter((key) => intake.redFlags[key] === answer).map((key) => RED_FLAG_LABELS[key]);

  let onset = NOT_REPORTED;
  if (elapsed) {
    onset = `confirmed by the student, ${hoursText(elapsed.hours)} before the displayed fixture clock`;
  } else if (intake.onsetIso) {
    onset = "reported but not confirmed by the student";
  }

  return {
    patient: `${profile.name}, age ${profile.age} (synthetic demo profile)`,
    symptoms: intake.symptoms.length > 0 ? list(intake.symptoms) : NOT_REPORTED,
    maxTemperature: intake.maxTempF === null ? NOT_REPORTED : `${intake.maxTempF}°F`,
    onset,
    deadlineToday: intake.deadlineToday ?? NOT_REPORTED,
    medicationsTaken: reportedList(intake.medsTaken),
    allergies: reportedList(intake.allergies),
    checklistAnsweredYes: flags(true),
    checklistAnsweredNo: flags(false),
    checklistNotAnswered: flags(null),
    coverage: `${plan?.name ?? "Fictional demo plan"} — mock coverage, not verified`,
    demoRoutingResult: BRANCH_LABEL[routing.branch],
    demoRoutingReasons: routing.reasons,
  };
}

function checklistSentence(facts: ReturnType<typeof sbarFacts>): string {
  const parts: string[] = [];
  if (facts.checklistAnsweredYes.length > 0) {
    parts.push(`Answered yes: ${list(facts.checklistAnsweredYes)}.`);
  }
  if (facts.checklistNotAnswered.length > 0) {
    parts.push(`Not answered: ${list(facts.checklistNotAnswered)}.`);
  }
  if (facts.checklistAnsweredYes.length === 0 && facts.checklistNotAnswered.length === 0) {
    parts.push("Every demo checklist item was answered no by the student.");
  }
  return parts.join(" ");
}

/** Same shape as the generated brief, assembled from current fields with no model call. */
export function deterministicSbar(
  intake: ReviewedIntake,
  profile: Profile,
  routing: DemoRoutingResult,
): Sbar {
  const facts = sbarFacts(intake, profile, routing);
  const checklist = checklistSentence(facts);

  return {
    situation: `${profile.name}, age ${profile.age}, reports symptoms: ${facts.symptoms}. Maximum temperature: ${facts.maxTemperature}. Deadline today: ${facts.deadlineToday}.`,
    background: `Onset: ${facts.onset}. Medications taken: ${facts.medicationsTaken}. Allergies: ${facts.allergies}. Coverage: ${facts.coverage}.`,
    assessment: `Demo routing result: ${facts.demoRoutingResult}. ${checklist} This is rule execution on reviewed answers, not a diagnosis.`,
    recommendation: RECOMMENDATION[routing.branch],
    spokenScript: `${profile.name}, age ${profile.age}, reports ${facts.symptoms}. Maximum temperature ${facts.maxTemperature}. Onset ${facts.onset}. Medications ${facts.medicationsTaken}; allergies ${facts.allergies}. ${checklist} Demo routing result: ${facts.demoRoutingResult}. Coverage is mock and not verified. Booking is not connected.`,
    source: "deterministic",
  };
}

/** The seeded Scene 1 brief. Callers may use it only after an explicit user action. */
export function preparedSbar(): Sbar {
  return fixtures.brief.sbar;
}

const SYSTEM_PROMPT = `You draft an SBAR hand-off brief for a synthetic demo patient in a prototype. You are given reviewed FACTS as JSON.

Rules:
- Use only the FACTS. Never add, infer, or soften anything.
- When a fact says "not reported", say "not reported". Never turn it into a negative such as "no known allergies" or "denies".
- "none reported" means the student explicitly answered none; keep that wording.
- Do not diagnose or name any condition. Do not recommend or mention any drug, therapy, product, or manufacturer.
- Coverage is mock and not verified. Never say or imply that insurance or coverage was checked or verified.
- The assessment must start with "Demo routing result:" and state that it is not a diagnosis.
- The recommendation must state that booking is not connected.
- spokenScript is what a presenter reads aloud: plain sentences, 50 to 65 words, but never drop a reported fact to meet the length.`;

const FORBIDDEN_CLAIMS = [
  /\b(coverage|insurance)\b[^.]{0,60}\b(is|was|has been|were)\s+verified\b/i,
  /\bdiagnos(is|ed) (of|with|is)\b/i,
  /\bprescri(be|bed|ption)\b/i,
];

/** Checks generated text against the intake; any hit means fall back to deterministic. */
export function sbarGuardrailViolation(
  sbar: z.infer<typeof generatedSchema>,
  intake: ReviewedIntake,
): string | null {
  const text = Object.values(sbar).join(" ");
  const lower = text.toLowerCase();

  for (const therapy of fixtures.therapies) {
    if (lower.includes(therapy.name.toLowerCase())) return "mentions a therapy";
    if (lower.includes(therapy.manufacturer.toLowerCase())) return "mentions a manufacturer";
  }
  for (const pattern of FORBIDDEN_CLAIMS) {
    if (pattern.test(text)) return "makes a forbidden claim";
  }
  if (intake.allergies === null && /\bno (known )?(drug )?allerg/i.test(text)) {
    return "invents a negative for allergies";
  }
  if (intake.medsTaken === null && /\b(no|not taking any|denies) (medications?|meds)\b/i.test(text)) {
    return "invents a negative for medications";
  }
  const unanswered = RED_FLAG_KEYS.some((key) => intake.redFlags[key] === null);
  if (unanswered && /\bno red flags?\b/i.test(text)) {
    return "invents a clean checklist";
  }
  return null;
}

/** Returns a generated brief, or null when generation fails or breaks a guardrail. */
export async function generateSbar(
  sessionId: string,
  intake: ReviewedIntake,
  profile: Profile,
  routing: DemoRoutingResult,
): Promise<Sbar | null> {
  const result = await generateStructured({
    sessionId,
    schema: generatedSchema,
    system: SYSTEM_PROMPT,
    prompt: `FACTS:\n${JSON.stringify(sbarFacts(intake, profile, routing), null, 2)}`,
    promptVersion: SBAR_PROMPT_VERSION,
  });
  if (!result.ok) return null;
  if (sbarGuardrailViolation(result.data, intake)) return null;
  return { ...result.data, source: "generated" };
}

/**
 * The brief for an intake. `usePrepared` must originate from an explicit user
 * action; a changed input never yields the prepared fixture on its own.
 */
export async function buildSbar({
  sessionId,
  intake,
  profile,
  routing,
  usePrepared = false,
}: {
  sessionId: string;
  intake: ReviewedIntake;
  profile: Profile;
  routing: DemoRoutingResult;
  usePrepared?: boolean;
}): Promise<Sbar> {
  if (usePrepared) return preparedSbar();
  return (
    (await generateSbar(sessionId, intake, profile, routing)) ??
    deterministicSbar(intake, profile, routing)
  );
}
