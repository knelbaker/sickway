import "server-only";
import { randomUUID } from "node:crypto";
import { getItem, putItemIfAbsent, queryByPrefix, sk, SK_PREFIX } from "@/lib/db";
import { routeIntake } from "@/lib/demo-routing";
import { fixtures } from "@/lib/fixtures";
import type { EncounterQueueItem } from "@/lib/api-contracts";
import { buildSbar, deterministicSbar, preparedSbar } from "@/lib/sbar";
import {
  encounterSchema,
  type DemoSession,
  type Encounter,
  type FieldSource,
  type InstructionLanguage,
  type ReviewedIntake,
} from "@/lib/schemas";

/** Fields the student reviewed on `/s`; everything else shown comes from the synthetic profile. */
const STUDENT_FIELDS = [
  "symptoms",
  "onsetIso",
  "onsetConfirmed",
  "maxTempF",
  "medsTaken",
  "allergies",
  "redFlags",
  "deadlineToday",
  "transcript",
] as const satisfies readonly (keyof ReviewedIntake)[];

const PROFILE_FIELDS = ["name", "age", "plan", "instructionLanguages", "costCeiling"] as const;

export function fieldSourcesFor(source: "student_review" | "demo_fixture" = "student_review"): Record<string, FieldSource> {
  return Object.fromEntries([
    ...STUDENT_FIELDS.map((field) => [field, source] as const),
    ...PROFILE_FIELDS.map((field) => [field, "synthetic_profile"] as const),
  ]);
}

/**
 * Persists a consented, reviewed intake as an encounter in the caller's session
 * (sickway.md §6.3, §8). Callers must have verified consent already; the status
 * always comes from server-side routing, never from the client.
 */
export async function createEncounter(
  session: DemoSession,
  reviewedIntake: ReviewedIntake | "prepared_demo",
  preferredInstructionLanguages?: InstructionLanguage[],
): Promise<Encounter> {
  // "Use prepared demo" is an explicit user choice (§4.1). The scripted case and its brief come
  // from the fixtures on the server, and every student field is recorded as demo_fixture.
  const prepared = reviewedIntake === "prepared_demo";
  const intake: ReviewedIntake = prepared ? fixtures.profile.intake : reviewedIntake;
  const routing = routeIntake(intake);
  const now = new Date().toISOString();

  // Every consented intake gets a brief, including positive and unanswered checklist items.
  const sbar = prepared
    ? preparedSbar()
    : await buildSbar({ sessionId: session.id, intake, profile: fixtures.profile, routing });

  const encounter = encounterSchema.parse({
    id: randomUUID(),
    demoSessionId: session.id,
    profileId: session.profileId,
    createdAt: now,
    status: routing.branch,
    intake,
    consent: { shareWithClinic: true, capturedAt: now },
    fieldSources: {
      ...fieldSourcesFor(prepared ? "demo_fixture" : "student_review"),
      // Once the student chooses, the preference is theirs rather than the profile's.
      ...(preferredInstructionLanguages ? { instructionLanguages: "student_review" as const } : {}),
    },
    sbar,
    unlockedTherapyIds: [],
    preferredInstructionLanguages,
  } satisfies Encounter);

  const created = await putItemIfAbsent(session.id, sk.encounter(encounter.id), encounter);
  if (!created) throw new Error("Encounter ID collision");
  return encounter;
}

/** The session's consented encounters, newest first. Only consented intakes are ever stored. */
export async function listEncounters(sessionId: string): Promise<EncounterQueueItem[]> {
  const encounters = await queryByPrefix(sessionId, SK_PREFIX.encounter, encounterSchema);
  return encounters
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((encounter) => ({
      id: encounter.id,
      createdAt: encounter.createdAt,
      status: encounter.status,
      displayName: fixtures.profile.name,
      chiefSymptoms: encounter.intake.symptoms,
    }));
}

/** Null when the encounter is not in this session, even if the ID exists in another one. */
export async function getEncounter(sessionId: string, encounterId: string): Promise<Encounter | null> {
  let key: string;
  try {
    key = sk.encounter(encounterId);
  } catch {
    return null; // an ID we could never have issued
  }
  const encounter = await getItem(sessionId, key, encounterSchema);
  if (!encounter || encounter.sbar) return encounter;

  // Older emergency encounters were saved without a brief. Summarize their own
  // reviewed answers on read so existing demo sessions work without resubmitting.
  return {
    ...encounter,
    sbar: deterministicSbar(encounter.intake, fixtures.profile, routeIntake(encounter.intake)),
  };
}
