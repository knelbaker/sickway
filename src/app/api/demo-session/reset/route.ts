import { demoSessionResponseSchema } from "@/lib/api-contracts";
import { errorJson, json } from "@/lib/http";
import { requireSession, resetDemoSession } from "@/lib/session";

/**
 * Replaces the caller's session with a fresh one and marks the old one as
 * superseded, so the paired device is prompted to follow. Old records are left
 * to expire by ttl and are never served again.
 */
export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    const { session, token } = await resetDemoSession(auth.session);
    return json(
      demoSessionResponseSchema.parse({
        sessionId: session.id,
        token,
        profileId: session.profileId,
        fixtureClock: session.fixtureClock,
        createdAt: session.createdAt,
        ttl: session.ttl,
      }),
      201,
    );
  } catch {
    return errorJson(503, "reset_unavailable");
  }
}
