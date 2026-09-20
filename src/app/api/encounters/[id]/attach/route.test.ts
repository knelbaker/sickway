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

import { attachResponseSchema, sampleEncounterDetailResponse } from "@/lib/api-contracts";
import { encounterSchema, packetSchema } from "@/lib/schemas";
import { POST } from "./route";

const SESSION_A = "a".repeat(32);
const SESSION_B = "b".repeat(32);
const GENERIC = "therapy-generic-demo";
const BRAND = "therapy-brand-demo";

const genericSelection = {
  confirmed: true,
  therapyId: GENERIC,
  pharmacyId: "pharmacy-demo-a",
  mockPrice: 12,
  instructionLanguages: ["es"],
  resourceIds: [],
};
const brandSelection = { ...genericSelection, therapyId: BRAND, mockPrice: 45, resourceIds: ["resource-demo-copay"] };

async function seed(sessionId: string, id: string, changes: Record<string, unknown> = {}) {
  await fake.db.putItem(sessionId, `ENC#${id}`, { ...sampleEncounterDetailResponse, id, demoSessionId: sessionId, ...changes });
}

function attach(id: string, body: unknown) {
  return POST(new Request(`http://localhost/api/encounters/${id}/attach`, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
}

const packets = () => [...fake.db.items.entries()].filter(([key]) => key.includes("|PKT#")).map(([, item]) => packetSchema.parse(item));
const encounter = (id = "enc-1") => encounterSchema.parse(fake.db.items.get(`${SESSION_A}|ENC#${id}`));

beforeEach(async () => {
  fake.db.items.clear();
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ ok: true, session: { id: SESSION_A } });
  await seed(SESSION_A, "enc-1");
});

describe("POST /api/encounters/:id/attach", () => {
  it("stores one packet and marks the encounter packet_available", async () => {
    const response = await attach("enc-1", genericSelection);
    const body = attachResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.packet).toMatchObject({
      demoSessionId: SESSION_A,
      encounterId: "enc-1",
      therapyId: GENERIC,
      pharmacyId: "pharmacy-demo-a",
      mockPrice: 12,
      instructionLanguages: ["es"],
      resourceIds: [],
      status: "available_in_demo",
    });
    expect(packets()).toHaveLength(1);
    expect(encounter()).toMatchObject({ status: "packet_available", chosenTherapyId: GENERIC, packetId: body.packetId });
  });

  it.each([
    ["absent", (({ confirmed: _c, ...rest }) => (void _c, rest))(genericSelection)],
    ["false", { ...genericSelection, confirmed: false }],
    ["a truthy string", { ...genericSelection, confirmed: "true" }],
  ])("stores nothing when confirmation is %s", async (_label, body) => {
    const response = await attach("enc-1", body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "confirmation_required" });
    expect(packets()).toEqual([]);
    expect(encounter().status).toBe("ready");
  });

  it("refuses a resource whose therapy was never unlocked", async () => {
    const response = await attach("enc-1", brandSelection);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "resource_locked" });
    expect(packets()).toEqual([]);
  });

  it("attaches an unlocked therapy's resource", async () => {
    await seed(SESSION_A, "enc-1", { unlockedTherapyIds: [BRAND] });

    const body = await (await attach("enc-1", brandSelection)).json();

    expect(body.packet.resourceIds).toEqual(["resource-demo-copay"]);
  });

  it("refuses a brand resource on a generic packet even when the brand is unlocked", async () => {
    await seed(SESSION_A, "enc-1", { unlockedTherapyIds: [BRAND] });

    const response = await attach("enc-1", { ...genericSelection, resourceIds: ["resource-demo-copay"] });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "resource_therapy_mismatch" });
  });

  it("returns the same packet and creates no duplicate when attach is repeated", async () => {
    const first = await (await attach("enc-1", genericSelection)).json();
    const second = await (await attach("enc-1", genericSelection)).json();
    const different = await (await attach("enc-1", { ...genericSelection, pharmacyId: "pharmacy-demo-b", mockPrice: 18 })).json();

    expect(second.packetId).toBe(first.packetId);
    expect(second.packet).toEqual(first.packet);
    expect(different.packet).toEqual(first.packet);
    expect(packets()).toHaveLength(1);
  });

  it("handles two simultaneous confirms as one packet", async () => {
    const [a, b] = await Promise.all([attach("enc-1", genericSelection), attach("enc-1", genericSelection)]);

    expect((await a.json()).packetId).toBe((await b.json()).packetId);
    expect(packets()).toHaveLength(1);
  });

  it.each([
    ["an unknown therapy", { ...genericSelection, therapyId: "therapy-made-up" }, "unknown_selection"],
    ["an unknown pharmacy", { ...genericSelection, pharmacyId: "pharmacy-made-up" }, "unknown_selection"],
    ["a price that is not the fixture price", { ...genericSelection, mockPrice: 1 }, "price_mismatch"],
    ["an unknown resource", { ...genericSelection, resourceIds: ["resource-made-up"] }, "unknown_resource"],
    ["a repeated language", { ...genericSelection, instructionLanguages: ["en", "en"] }, "duplicate_language"],
  ])("rejects %s and stores nothing", async (_label, body, error) => {
    const response = await attach("enc-1", body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(packets()).toEqual([]);
  });

  it.each(["emergency", "needs_review"])("attaches a packet for a %s encounter without changing its reviewed answers", async (status) => {
    const intake = {
      ...sampleEncounterDetailResponse.intake,
      symptoms: ["dizziness"],
      redFlags: { ...sampleEncounterDetailResponse.intake.redFlags, dehydration: status === "emergency" ? true : null },
    };
    await seed(SESSION_A, "enc-x", { status, intake });

    const locked = await attach("enc-x", brandSelection);
    expect(locked.status).toBe(403);
    expect(packets()).toEqual([]);

    const response = await attach("enc-x", genericSelection);

    expect(response.status).toBe(200);
    const body = attachResponseSchema.parse(await response.json());
    const stored = encounterSchema.parse(fake.db.items.get(`${SESSION_A}|ENC#enc-x`));
    expect(stored).toMatchObject({ status: "packet_available", packetId: body.packetId, intake });
    expect(packets()).toHaveLength(1);
    const repeated = attachResponseSchema.parse(await (await attach("enc-x", genericSelection)).json());
    expect(repeated.packetId).toBe(body.packetId);
    expect(packets()).toHaveLength(1);
  });

  it("returns 404 for another session's encounter and stores nothing", async () => {
    await seed(SESSION_B, "enc-b");

    expect((await attach("enc-b", genericSelection)).status).toBe(404);
    expect(packets()).toEqual([]);
  });

  it("returns 401 without a valid session", async () => {
    requireSession.mockResolvedValue({ ok: false, response: Response.json({ error: "invalid_session" }, { status: 401 }) });

    expect((await attach("enc-1", genericSelection)).status).toBe(401);
  });
});
