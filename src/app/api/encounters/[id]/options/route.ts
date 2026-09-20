import { optionsRequestSchema, optionsResponseSchema } from "@/lib/api-contracts";
import { getEncounter } from "@/lib/encounters";
import { errorJson, json } from "@/lib/http";
import { matchOptions } from "@/lib/options";
import { requireSession } from "@/lib/session";

/**
 * Labelled fixture options for an encounter. Read-only: a category lookup never
 * changes `unlockedTherapyIds` (sickway.md §7.3, §7.4).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const encounter = await getEncounter(auth.session.id, id);
  if (!encounter) return errorJson(404, "encounter_not_found");

  const body = optionsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || body.data.query.length > 500) return errorJson(400, "invalid_request");

  const match = matchOptions(body.data.query);
  return json(
    optionsResponseSchema.parse(
      match.found ? match : { found: false, message: "No demo option found" },
    ),
  );
}
