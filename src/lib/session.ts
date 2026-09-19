import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getItem, putItemIfAbsent, sk, ttlFromNow, updateItem } from "@/lib/db";
import { env } from "@/lib/env";
import { fixtures } from "@/lib/fixtures";
import { errorJson } from "@/lib/http";
import { demoSessionSchema, type DemoSession } from "@/lib/schemas";

/**
 * Demo sessions pair the student and clinician devices (sickway.md §8).
 *
 * The token is `<sessionId>.<HMAC-SHA256(sessionId)>`. The session ID inside a
 * verified token is the only thing that selects a DynamoDB partition; routes
 * never accept a client-supplied session ID. This limits casual cross-session
 * access. It is not production authentication.
 */

export const SESSION_HEADER = "x-demo-session";

/** META as stored. A reset marks the old session with the token of the one that replaced it. */
const storedSessionSchema = demoSessionSchema.extend({
  supersededByToken: z.string().min(1).optional(),
});

function sign(sessionId: string): string {
  return createHmac("sha256", env.DEMO_SESSION_SECRET).update(sessionId).digest("base64url");
}

export function createSessionToken(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

/** Returns the session ID for an authentic token, otherwise null. */
export function verifySessionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const sessionId = token.slice(0, separator);
  // Session IDs are generated as hex; anything else could not have been issued here.
  if (!/^[a-f0-9]{32}$/.test(sessionId)) return null;

  const given = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(sessionId));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return sessionId;
}

/** Creates an isolated session with the synthetic fixture profile and clock. */
export async function createDemoSession(): Promise<{ session: DemoSession; token: string }> {
  const session: DemoSession = {
    id: randomBytes(16).toString("hex"),
    profileId: fixtures.profile.id,
    fixtureClock: fixtures.profile.fixtureClock,
    createdAt: new Date().toISOString(),
    ttl: ttlFromNow(),
  };
  const created = await putItemIfAbsent(session.id, sk.meta(), session);
  if (!created) throw new Error("Session ID collision");
  return { session, token: createSessionToken(session.id) };
}

/**
 * Reset (sickway.md §8): a fresh session replaces the current one. The old
 * session is never reused; it is marked so the paired device can follow.
 */
export async function resetDemoSession(current: DemoSession): Promise<{ session: DemoSession; token: string }> {
  const next = await createDemoSession();
  await updateItem(current.id, sk.meta(), { supersededByToken: next.token }, storedSessionSchema);
  return next;
}

export type SessionCheck =
  | { ok: true; session: DemoSession }
  | { ok: false; response: Response };

/**
 * Guard for every session-scoped route:
 *
 *   const auth = await requireSession(request);
 *   if (!auth.ok) return auth.response;
 *   // use auth.session.id for every db call
 */
export async function requireSession(request: Request): Promise<SessionCheck> {
  const unauthorized = (reason: string): SessionCheck => ({
    ok: false,
    response: errorJson(401, reason),
  });

  const sessionId = verifySessionToken(request.headers.get(SESSION_HEADER));
  if (!sessionId) return unauthorized("invalid_session");

  const stored = await getItem(sessionId, sk.meta(), storedSessionSchema);
  // DynamoDB TTL deletion is asynchronous; never honour an expired record.
  if (!stored || stored.ttl <= Math.floor(Date.now() / 1000)) {
    return unauthorized("expired_session");
  }
  // After a reset the old session serves no data at all, only the way to the new one.
  if (stored.supersededByToken) {
    return {
      ok: false,
      response: errorJson(409, "session_superseded", { joinToken: stored.supersededByToken }),
    };
  }
  return { ok: true, session: demoSessionSchema.parse(stored) };
}
