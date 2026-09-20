import "server-only";
import type { AttachRequest } from "@/lib/api-contracts";
import { getItem, putItemIfAbsent, sk, updateItem } from "@/lib/db";
import { fixtures } from "@/lib/fixtures";
import type { PacketView } from "@/lib/packet-view";
import { findResource } from "@/lib/resources";
import { encounterSchema, packetSchema, type Encounter, type Packet } from "@/lib/schemas";

/**
 * The returned packet (sickway.md §7.5). One packet per encounter, stored once:
 * both devices read this record, and nothing is transmitted to a pharmacy,
 * clinic, or anyone outside the demo session.
 */

export type AttachResult =
  | { ok: true; packet: Packet }
  | { ok: false; status: 400 | 403 | 409; error: string };

const refuse = (status: 400 | 403 | 409, error: string): AttachResult => ({ ok: false, status, error });

/** One packet per encounter makes a repeated attach naturally idempotent. */
export function packetIdFor(encounterId: string): string {
  return encounterId;
}

/** Checks a confirmed selection against the fixtures and the encounter's unlocked therapies. */
export function validateSelection(encounter: Encounter, request: AttachRequest): AttachResult | null {
  const therapy = fixtures.therapies.find((row) => row.id === request.therapyId);
  const pharmacy = fixtures.pharmacies.find((row) => row.id === request.pharmacyId);
  if (!therapy || !pharmacy) return refuse(400, "unknown_selection");

  // The confirmed price must be the fixture's price; a client-supplied number is never trusted.
  const price = pharmacy.prices.find(
    (row) => row.therapyId === therapy.id && row.planId === fixtures.profile.planId,
  );
  if (!price || price.estimatedCost !== request.mockPrice) return refuse(400, "price_mismatch");

  if (new Set(request.instructionLanguages).size !== request.instructionLanguages.length) {
    return refuse(400, "duplicate_language");
  }
  if (new Set(request.resourceIds).size !== request.resourceIds.length) {
    return refuse(400, "duplicate_resource");
  }

  for (const resourceId of request.resourceIds) {
    const resource = findResource(resourceId);
    if (!resource) return refuse(400, "unknown_resource");
    // The gate applies to attachment too: never attach a resource that was not unlocked (§7.4).
    if (!encounter.unlockedTherapyIds.includes(resource.therapyId)) return refuse(403, "resource_locked");
    if (resource.therapyId !== therapy.id) return refuse(400, "resource_therapy_mismatch");
  }
  return null;
}

/**
 * Stores the packet once and marks the encounter. A repeat call, from a double
 * click or a retry, returns the existing packet and changes nothing.
 */
export async function attachPacket(
  sessionId: string,
  encounter: Encounter,
  request: AttachRequest,
): Promise<AttachResult> {
  const packetId = packetIdFor(encounter.id);
  const key = sk.packet(packetId);

  let packet = await getItem(sessionId, key, packetSchema);
  if (!packet) {
    const invalid = validateSelection(encounter, request);
    if (invalid) return invalid;

    const candidate: Packet = packetSchema.parse({
      id: packetId,
      demoSessionId: sessionId,
      encounterId: encounter.id,
      therapyId: request.therapyId,
      pharmacyId: request.pharmacyId,
      mockPrice: request.mockPrice,
      resourceIds: request.resourceIds,
      instructionLanguages: request.instructionLanguages,
      createdAt: new Date().toISOString(),
      status: "available_in_demo",
    });
    const created = await putItemIfAbsent(sessionId, key, candidate);
    // Lost a race with another request: the first writer's packet stands.
    packet = created ? candidate : await getItem(sessionId, key, packetSchema);
    if (!packet) throw new Error("Packet missing after conditional write");
  }

  // Also repairs an encounter whose update failed after an earlier packet write.
  if (encounter.packetId !== packet.id || encounter.status !== "packet_available") {
    await updateItem(
      sessionId,
      sk.encounter(encounter.id),
      { chosenTherapyId: packet.therapyId, packetId: packet.id, status: "packet_available" },
      encounterSchema,
    );
  }
  return { ok: true, packet };
}

/** Null when the packet is not in this session, even if the ID exists in another one. */
export async function getPacket(sessionId: string, packetId: string): Promise<Packet | null> {
  let key: string;
  try {
    key = sk.packet(packetId);
  } catch {
    return null; // an ID we could never have issued
  }
  return getItem(sessionId, key, packetSchema);
}

/**
 * Adds display text to a stored packet. The price is the one stored at attach
 * time; it is never recomputed from the fixtures.
 */
export function buildPacketView(packet: Packet): PacketView {
  const { profile, plans, therapies, pharmacies, instructionsEn, instructionsEs } = fixtures;
  const therapy = therapies.find((row) => row.id === packet.therapyId);
  const pharmacy = pharmacies.find((row) => row.id === packet.pharmacyId);
  const plan = plans.find((row) => row.id === profile.planId);
  const coverage = plan?.formulary.find((row) => row.therapyId === packet.therapyId);
  const price = pharmacy?.prices.find((row) => row.therapyId === packet.therapyId && row.planId === profile.planId);
  const copy = { en: instructionsEn, es: instructionsEs };

  return {
    ...packet,
    display: {
      patientName: profile.name,
      therapyName: therapy?.name ?? "Demo therapy",
      generic: therapy?.generic ?? false,
      pharmacyName: pharmacy?.name ?? "Fictional demo pharmacy",
      planName: plan?.name ?? "Fictional demo plan",
      coverageStatus: coverage?.coverageStatus ?? "Mock coverage",
      coverageMockLabel: plan?.mockLabel ?? "Mock coverage — not verified",
      stockStatus: price?.stockStatus ?? "Mock stock",
      instructions: packet.instructionLanguages.flatMap((language) => {
        const text = copy[language].therapies[packet.therapyId];
        return text ? [{ language, mockLabel: copy[language].mockLabel, ...text }] : [];
      }),
      resources: packet.resourceIds.flatMap((id) => findResource(id) ?? []),
    },
  };
}
