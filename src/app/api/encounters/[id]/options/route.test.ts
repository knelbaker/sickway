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

import { optionsResponseSchema, sampleEncounterDetailResponse, sampleOptionsRequest } from "@/lib/api-contracts";
import { POST } from "./route";

const SESSION_A = "a".repeat(32);
const SESSION_B = "b".repeat(32);

async function seed(sessionId: string, id: string, changes: Record<string, unknown> = {}) {
  await fake.db.putItem(sessionId, `ENC#${id}`, { ...sampleEncounterDetailResponse, id, demoSessionId: sessionId, ...changes });
}

function ask(id: string, body: unknown) {
  return POST(new Request(`http://localhost/api/encounters/${id}/options`, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(async () => {
  fake.db.items.clear();
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ ok: true, session: { id: SESSION_A } });
  await seed(SESSION_A, "enc-1");
});

describe("POST /api/encounters/:id/options", () => {
  it("returns generic-first labelled rows for the scripted category question", async () => {
    const response = await ask("enc-1", sampleOptionsRequest);
    const body = optionsResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.found && body.rows.map((row) => row.generic)).toEqual([true, true, false, false]);
  });

  it("returns No demo option found with no rows for an unsupported category", async () => {
    const body = await (await ask("enc-1", { query: "Show antibiotic options" })).json();

    expect(body).toEqual({ found: false, message: "No demo option found" });
  });

  it("never changes unlockedTherapyIds, however often it is called", async () => {
    const before = structuredClone(fake.db.items.get(`${SESSION_A}|ENC#enc-1`));

    for (const query of ["antiviral options", "Fictional Brand Antiviral Demo", "antibiotics"]) {
      await ask("enc-1", { query });
    }

    expect(fake.db.items.get(`${SESSION_A}|ENC#enc-1`)).toEqual(before);
    expect(fake.db.items.size).toBe(1);
  });

  it("returns 404 for an encounter from another session", async () => {
    await seed(SESSION_B, "enc-b");

    expect((await ask("enc-b", sampleOptionsRequest)).status).toBe(404);
  });

  it.each(["emergency", "needs_review"])("offers fixture options for a %s encounter", async (status) => {
    await seed(SESSION_A, "enc-emergency", { status });

    const response = await ask("enc-emergency", sampleOptionsRequest);

    expect(response.status).toBe(200);
    const body = optionsResponseSchema.parse(await response.json());
    expect(body.found && body.rows.length).toBeGreaterThan(0);
  });

  it.each([{}, { query: "" }, { query: "x".repeat(501) }])("returns 400 for the invalid body %j", async (body) => {
    expect((await ask("enc-1", body)).status).toBe(400);
  });

  it("returns 401 without a valid session", async () => {
    requireSession.mockResolvedValue({ ok: false, response: Response.json({ error: "invalid_session" }, { status: 401 }) });

    expect((await ask("enc-1", sampleOptionsRequest)).status).toBe(401);
  });
});
