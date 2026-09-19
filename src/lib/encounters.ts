import "server-only";
import { randomUUID } from "node:crypto";
import { putItemIfAbsent, sk } from "@/lib/db";
import { routeIntake } from "@/lib/demo-routing";
import { fixtures } from "@/lib/fixtures";
import { buildSbar } from "@/lib/sbar";
import {
  encounterSchema,
  type DemoSession,
  type Encounter,
  type FieldSource,
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

export function fieldSourcesFor(): Record<string, FieldSource> {
  return Object.fromEntries([
    ...STUDENT_FIELDS.map((field) => [field, "student_review"] as const),
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
  intake: ReviewedIntake,
): Promise<Encounter> {
  const routing = routeIntake(intake);
  const now = new Date().toISOString();

  // The emergency branch bypasses the routine flow: no brief, options, or packet path.
  const sbar =
    routing.branch === "emergency"
      ? undefined
      : await buildSbar({ sessionId: session.id, intake, profile: fixtures.profile, routing });

  const encounter = encounterSchema.parse({
    id: randomUUID(),
    demoSessionId: session.id,
    profileId: session.profileId,
    createdAt: now,
    status: routing.branch,
    intake,
    consent: { shareWithClinic: true, capturedAt: now },
    fieldSources: fieldSourcesFor(),
    sbar,
    unlockedTherapyIds: [],
  } satisfies Encounter);

  const created = await putItemIfAbsent(session.id, sk.encounter(encounter.id), encounter);
  if (!created) throw new Error("Encounter ID collision");
  return encounter;
}
