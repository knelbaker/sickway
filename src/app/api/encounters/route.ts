import { encountersQueueResponseSchema } from "@/lib/api-contracts";
import { listEncounters } from "@/lib/encounters";
import { errorJson, json } from "@/lib/http";
import { requireSession } from "@/lib/session";

/** The clinician queue for the caller's paired session, newest first. Polled every two seconds. */
export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    return json(encountersQueueResponseSchema.parse(await listEncounters(auth.session.id)));
  } catch {
    return errorJson(503, "queue_unavailable");
  }
}
