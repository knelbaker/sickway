// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeDb } from "@/lib/__tests__/helpers/fake-db";

vi.mock("server-only", () => ({}));

const { fake, requireSession } = vi.hoisted(() => ({
  fake: { db: undefined as unknown as FakeDb },
  requireSession: vi.fn(),
}));

vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("@/lib/__tests__/helpers/fake-db");
  return (fake.db = createFakeDb());
});
vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("@/lib/ai", () => ({ generateStructured: vi.fn() }));

import { followUpResponseSchema, sampleEncounterDetailResponse, sampleFollowUpRequest } from "@/lib/api-contracts";
import { encounterSchema } from "@/lib/schemas";
import { POST } from "./route";

const SESSION_A = "a".repeat(32);
const SESSION_B = "b".repeat(32);

async function seed(sessionId: string, id: string, changes: Record<string, unknown> = {}) {
  await fake.db.putItem(sessionId, `ENC#${id}`, { ...sampleEncounterDetailResponse, id, demoSessionId: sessionId, status: "packet_available", packetId: id, ...changes });
}
const report = (id: string, body: unknown) =>
  POST(new Request(`http://localhost/api/encounters/${id}/followup`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const stored = (sessionId = SESSION_A, id = "enc-1") => encounterSchema.parse(fake.db.items.get(`${sessionId}|ENC#${id}`));

beforeEach(async () => {
  fake.db.items.clear();
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ ok: true, session: { id: SESSION_A } });
  await seed(SESSION_A, "enc-1");
});

describe("POST /api/encounters/:id/followup", () => {
  it("records a simulated self-report on an encounter that has a packet", async () => {
    const response = await report("enc-1", sampleFollowUpRequest);

    expect(response.status).toBe(200);
    expect(followUpResponseSchema.parse(await response.json()).followUp).toEqual({ simulated: true, filled: true, symptomStatus: "improving" });
    expect(stored().followUp).toEqual({ simulated: true, filled: true, symptomStatus: "improving" });
    expect(stored().status).toBe("packet_available");
  });

  it("keeps one follow-up with the latest values on repeat taps", async () => {
    await report("enc-1", sampleFollowUpRequest);
    await report("enc-1", { simulated: true, filled: false, symptomStatus: "worse" });

    expect(stored().followUp).toEqual({ simulated: true, filled: false, symptomStatus: "worse" });
    expect(fake.db.items.size).toBe(1);
  });

  it.each(["ready", "needs_review", "emergency"])("returns 409 and stores nothing for a %s encounter without a packet", async (status) => {
    await seed(SESSION_A, "enc-x", { status, packetId: undefined });

    const response = await report("enc-x", sampleFollowUpRequest);

    expect(response.status).toBe(409);
    expect(stored(SESSION_A, "enc-x").followUp).toBeUndefined();
  });

  it.each([
    { ...sampleFollowUpRequest, simulated: false },
    { filled: true, symptomStatus: "improving" },
    { ...sampleFollowUpRequest, symptomStatus: "cured by the brand therapy" },
    {},
  ])("rejects %j: simulated must be literal true and the status one of the demo's choices", async (body) => {
    expect((await report("enc-1", body)).status).toBe(400);
    expect(stored().followUp).toBeUndefined();
  });

  it("returns 404 for another session's encounter and leaves it untouched", async () => {
    await seed(SESSION_B, "enc-b");

    expect((await report("enc-b", sampleFollowUpRequest)).status).toBe(404);
    expect(stored(SESSION_B, "enc-b").followUp).toBeUndefined();
  });

  it("returns 401 without a valid session", async () => {
    requireSession.mockResolvedValue({ ok: false, response: Response.json({ error: "invalid_session" }, { status: 401 }) });

    expect((await report("enc-1", sampleFollowUpRequest)).status).toBe(401);
  });
});
