import { z } from "zod";
import { attachRequestSchema, attachResponseSchema } from "@/lib/api-contracts";
import { getEncounter } from "@/lib/encounters";
import { errorJson, json } from "@/lib/http";
import { attachPacket } from "@/lib/packet";
import { requireSession } from "@/lib/session";

const confirmed = z.object({ confirmed: z.literal(true) });

/**
 * Attaches the clinician's confirmed selection as the encounter's packet.
 * Requires explicit confirmation, re-checks the resource gate, and is idempotent.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const encounter = await getEncounter(auth.session.id, id);
  if (!encounter) return errorJson(404, "encounter_not_found");

  const body: unknown = await request.json().catch(() => null);
  if (!confirmed.safeParse(body).success) return errorJson(400, "confirmation_required");

  const parsed = attachRequestSchema.safeParse(body);
  if (!parsed.success) return errorJson(400, "invalid_request");

  try {
    const result = await attachPacket(auth.session.id, encounter, parsed.data);
    if (!result.ok) return errorJson(result.status, result.error);
    return json(
      attachResponseSchema.parse({
        packetId: result.packet.id,
        encounterId: encounter.id,
        status: "packet_available",
        packet: result.packet,
      }),
    );
  } catch {
    return errorJson(503, "attach_unavailable");
  }
}
