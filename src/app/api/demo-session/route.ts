import { demoSessionResponseSchema } from "@/lib/api-contracts";
import { errorJson, json } from "@/lib/http";
import { createDemoSession, createSessionToken, requireSession } from "@/lib/session";

/** Creates an isolated synthetic session and returns its pairing token. */
export async function POST() {
  try {
    const { session, token } = await createDemoSession();
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
    return errorJson(503, "session_unavailable");
  }
}

/** Describes the caller's current session, so a joining device can confirm the pairing. */
export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const { session } = auth;
  return json(
    demoSessionResponseSchema.parse({
      sessionId: session.id,
      token: createSessionToken(session.id),
      profileId: session.profileId,
      fixtureClock: session.fixtureClock,
      createdAt: session.createdAt,
      ttl: session.ttl,
    }),
  );
}
