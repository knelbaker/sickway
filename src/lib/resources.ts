import "server-only";
import { randomUUID } from "node:crypto";
import { appendUniqueToList, putItem, sk } from "@/lib/db";
import { fixtures } from "@/lib/fixtures";
import { namedTherapyIds } from "@/lib/options";
import { auditEventSchema, type AuditEvent, type Encounter, type ManufacturerResource } from "@/lib/schemas";

/**
 * Manufacturer resource gate (sickway.md §7.4). Resources for a therapy are
 * returned only after an explicit, therapy-specific request, decided and
 * enforced here on the server and recorded in an audit log.
 *
 * This is a demonstrated UI and server rule. It does not by itself establish
 * the absence of commercial influence. No data is sent to any manufacturer.
 */

export type GateDecision =
  | { unlock: true; therapyId: string; reason: "explicit_therapy_action" | "named_therapy_request" }
  | { unlock: false; reason: string };

export function resourcesForTherapy(therapyId: string): ManufacturerResource[] {
  return fixtures.resources.filter((resource) => resource.therapyId === therapyId);
}

export function findResource(resourceId: string): ManufacturerResource | undefined {
  return fixtures.resources.find((resource) => resource.id === resourceId);
}

/** Words that show the clinician is asking for manufacturer resources rather than options or prices. */
const RESOURCE_WORDS = /\b(resources?|manufacturer|co-?pay|savings|assistance|card|educational?|materials?)\b/i;

/**
 * Pure decision: an explicit therapy ID, or text that both names exactly one
 * fixture therapy and asks for its manufacturer resources.
 */
export function decideUnlock(request: { therapyId?: string; text?: string }): GateDecision {
  if (request.therapyId !== undefined) {
    return fixtures.therapies.some((therapy) => therapy.id === request.therapyId)
      ? { unlock: true, therapyId: request.therapyId, reason: "explicit_therapy_action" }
      : { unlock: false, reason: "Therapy not found in demo. Resources remain locked." };
  }

  const text = request.text ?? "";
  const named = namedTherapyIds(text);
  // Naming a therapy is not enough: asking for its options or price must not unlock anything.
  if (named.length > 0 && !RESOURCE_WORDS.test(text)) {
    return {
      unlock: false,
      reason: "That asked about a therapy, not its manufacturer resources. Resources remain locked.",
    };
  }
  if (named.length === 1) return { unlock: true, therapyId: named[0], reason: "named_therapy_request" };
  if (named.length > 1) {
    return { unlock: false, reason: "More than one therapy was named. Request one therapy at a time. Resources remain locked." };
  }
  return {
    unlock: false,
    reason: "No specific demo therapy was named. A category request does not unlock manufacturer resources.",
  };
}

/**
 * Records the unlock and returns that therapy's resources only. Appending is
 * atomic and unique, so concurrent or repeated unlocks never drop or duplicate IDs.
 */
export async function unlockResources(
  sessionId: string,
  encounter: Encounter,
  decision: Extract<GateDecision, { unlock: true }>,
): Promise<{ resources: ManufacturerResource[]; auditEventId: string }> {
  const added = await appendUniqueToList(
    sessionId,
    sk.encounter(encounter.id),
    "unlockedTherapyIds",
    decision.therapyId,
  );
  const resources = resourcesForTherapy(decision.therapyId);

  const event: AuditEvent = auditEventSchema.parse({
    id: randomUUID(),
    demoSessionId: sessionId,
    encounterId: encounter.id,
    timestamp: new Date().toISOString(),
    action: added ? "unlock_manufacturer_resources" : "view_unlocked_manufacturer_resources",
    therapyId: decision.therapyId,
    resourceIds: resources.map((resource) => resource.id),
    reason: decision.reason,
  });
  await putItem(sessionId, sk.event(event.timestamp, event.id), event);

  return { resources, auditEventId: event.id };
}
