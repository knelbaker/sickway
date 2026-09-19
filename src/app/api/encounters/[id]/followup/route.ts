import { followUpRequestSchema, followUpResponseSchema } from "@/lib/api-contracts";
import { sk, updateItem } from "@/lib/db";
import { getEncounter } from "@/lib/encounters";
import { errorJson, json } from "@/lib/http";
import { encounterSchema } from "@/lib/schemas";
import { requireSession } from "@/lib/session";

const SYMPTOM_STATUSES = ["improving", "about the same", "worse"];

/**
 * Optional simulated follow-up (sickway.md §7.6). Records a synthetic
 * self-report on an encounter that already has a packet. `simulated` is always
 * literally true: this is never evidence of fulfilment or of a health outcome.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const encounter = await getEncounter(auth.session.id, id);
  if (!encounter) return errorJson(404, "encounter_not_found");
  if (encounter.status !== "packet_available") return errorJson(409, "packet_required");

  const body = followUpRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || !SYMPTOM_STATUSES.includes(body.data.symptomStatus)) {
    return errorJson(400, "invalid_request");
  }

  try {
    // One follow-up per encounter: a repeat tap replaces it rather than adding another.
    const followUp = { simulated: true as const, filled: body.data.filled, symptomStatus: body.data.symptomStatus };
    const updated = await updateItem(auth.session.id, sk.encounter(encounter.id), { followUp }, encounterSchema);
    if (!updated) return errorJson(404, "encounter_not_found");
    return json(followUpResponseSchema.parse({ encounterId: encounter.id, followUp }));
  } catch {
    return errorJson(503, "followup_unavailable");
  }
}
