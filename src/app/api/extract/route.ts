import { extractRequestSchema, extractResponseSchema } from "@/lib/api-contracts";
import { errorJson, json } from "@/lib/http";
import { extractIntake, MAX_INTAKE_TEXT_LENGTH } from "@/lib/intake";
import { requireSession } from "@/lib/session";

// Generation retries can outlast the platform's default function limit.
export const maxDuration = 60;

/**
 * Proposes candidate intake fields for the student to review. Writes no
 * encounter and no queue entry; nothing is shared with the clinic here.
 */
export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const body = extractRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || body.data.text.trim() === "" || body.data.text.length > MAX_INTAKE_TEXT_LENGTH) {
    return errorJson(400, "invalid_request");
  }

  const result = await extractIntake(auth.session.id, body.data.text, auth.session.fixtureClock);
  if (!result.ok) {
    // The student continues by entering fields manually; never substitute the seeded case.
    return errorJson(503, "extraction_unavailable", { reason: result.reason });
  }
  return json(extractResponseSchema.parse(result.response));
}
