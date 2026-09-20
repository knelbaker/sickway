import { resourcesRequestSchema, resourcesResponseSchema } from "@/lib/api-contracts";
import { getEncounter } from "@/lib/encounters";
import { errorJson, json } from "@/lib/http";
import { decideUnlock, unlockResources } from "@/lib/resources";
import { requireSession } from "@/lib/session";

/**
 * The only way manufacturer resources are ever returned. A category or
 * ambiguous request stays locked with a reason; an explicit therapy-specific
 * request unlocks that therapy alone and writes an audit event.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const encounter = await getEncounter(auth.session.id, id);
  if (!encounter) return errorJson(404, "encounter_not_found");

  const body = resourcesRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || (body.data.text?.length ?? 0) > 500) return errorJson(400, "invalid_request");

  const decision = decideUnlock(body.data);
  if (!decision.unlock) {
    return json(resourcesResponseSchema.parse({ unlocked: false, reason: decision.reason }));
  }

  try {
    const { resources, auditEventId } = await unlockResources(auth.session.id, encounter, decision);
    return json(
      resourcesResponseSchema.parse({ unlocked: true, therapyId: decision.therapyId, resources, auditEventId }),
    );
  } catch {
    // Without a recorded unlock and audit event, nothing is returned.
    return errorJson(503, "resources_unavailable");
  }
}
