import { encounterDetailResponseSchema } from "@/lib/api-contracts";
import { getEncounter } from "@/lib/encounters";
import { errorJson, json } from "@/lib/http";
import { requireSession } from "@/lib/session";

/** One encounter, only from the caller's session. An ID from another session is a 404. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const encounter = await getEncounter(auth.session.id, id);
    if (!encounter) return errorJson(404, "encounter_not_found");
    return json(encounterDetailResponseSchema.parse(encounter));
  } catch {
    return errorJson(503, "encounter_unavailable");
  }
}
