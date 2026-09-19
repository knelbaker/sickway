import { z } from "zod";
import { intakeRequestSchema, intakeResponseSchema } from "@/lib/api-contracts";
import { createEncounter } from "@/lib/encounters";
import { errorJson, json } from "@/lib/http";
import { requireSession } from "@/lib/session";

// Brief generation retries can outlast the platform's default function limit.
export const maxDuration = 60;

const consentGiven = z.object({ consent: z.object({ shareWithClinic: z.literal(true) }) });

/**
 * Shares a reviewed intake with the demo clinic. Nothing is stored unless
 * consent is literally `true`; declining keeps the intake on the student screen.
 */
export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const body: unknown = await request.json().catch(() => null);

  // Consent is checked on its own first so a decline is never mistaken for a malformed form.
  if (!consentGiven.safeParse(body).success) return errorJson(400, "consent_required");

  const parsed = intakeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(400, "invalid_intake", {
      fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))],
    });
  }

  try {
    const encounter = await createEncounter(auth.session, parsed.data.intake);
    return json(intakeResponseSchema.parse({ encounterId: encounter.id, status: encounter.status }), 201);
  } catch {
    return errorJson(503, "intake_unavailable");
  }
}
