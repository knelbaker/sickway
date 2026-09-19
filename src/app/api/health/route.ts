import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { generateStructured } from "@/lib/ai";
import { deleteItem, getItem, putItemIfAbsent, sk } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";

/**
 * Integration checkpoint (sickway.md §4.1, §14): one DynamoDB round trip and one
 * minimal Gemini call from the deployed environment.
 *
 * Requires `x-health-key: <DEMO_SESSION_SECRET>`; anything else gets a 404 before
 * any service is touched, so the route cannot be used to burn model quota.
 */

const probeSchema = z.object({ id: z.string(), probe: z.literal("health") });
const pingSchema = z.object({ ok: z.literal(true) });

function authorized(request: Request): boolean {
  const given = Buffer.from(request.headers.get("x-health-key") ?? "");
  const expected = Buffer.from(env.DEMO_SESSION_SECRET);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function timed(check: () => Promise<{ ok: boolean; reason?: string }>) {
  const started = Date.now();
  try {
    return { ...(await check()), latencyMs: Date.now() - started };
  } catch {
    // Provider errors can carry request details; report a generic reason only.
    return { ok: false, reason: "error", latencyMs: Date.now() - started };
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Not Found", { status: 404 });

  // A throwaway partition: never a real demo session, expires by ttl.
  const sessionId = `health-${randomUUID()}`;

  const dynamodb = await timed(async () => {
    const key = sk.encounter("probe");
    const record = { id: "probe", probe: "health" as const };
    const created = await putItemIfAbsent(sessionId, key, record);
    const stored = await getItem(sessionId, key, probeSchema);
    await deleteItem(sessionId, key);
    return { ok: created && stored?.id === record.id };
  });

  const gemini = await timed(async () => {
    const result = await generateStructured({
      sessionId,
      schema: pingSchema,
      system: "You are a connectivity check. Reply with the JSON object {\"ok\": true}.",
      prompt: "ping",
      promptVersion: "health-v1",
    });
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  });

  return json({ dynamodb, gemini }, dynamodb.ok && gemini.ok ? 200 : 503);
}
