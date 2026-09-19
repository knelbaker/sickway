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

import { resourcesResponseSchema, sampleEncounterDetailResponse } from "@/lib/api-contracts";
import { fixtures } from "@/lib/fixtures";
import { decideUnlock } from "@/lib/resources";
import { auditEventSchema, encounterSchema } from "@/lib/schemas";
import { POST } from "./route";

const SESSION_A = "a".repeat(32);
const SESSION_B = "b".repeat(32);
const GENERIC = "therapy-generic-demo";
const BRAND = "therapy-brand-demo";
const BRAND_NAME = fixtures.therapies.find((therapy) => therapy.id === BRAND)!.name;

async function seed(sessionId: string, id: string, changes: Record<string, unknown> = {}) {
  await fake.db.putItem(sessionId, `ENC#${id}`, { ...sampleEncounterDetailResponse, id, demoSessionId: sessionId, ...changes });
}

function ask(id: string, body: unknown) {
  return POST(new Request(`http://localhost/api/encounters/${id}/resources`, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
}

function unlocked(sessionId = SESSION_A, id = "enc-1") {
  return encounterSchema.parse(fake.db.items.get(`${sessionId}|ENC#${id}`)).unlockedTherapyIds;
}

function auditEvents() {
  return [...fake.db.items.entries()]
    .filter(([key]) => key.includes("|EVT#"))
    .map(([, item]) => auditEventSchema.parse(item));
}

beforeEach(async () => {
  fake.db.items.clear();
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ ok: true, session: { id: SESSION_A } });
  await seed(SESSION_A, "enc-1");
});

describe("decideUnlock", () => {
  it.each([
    "show antiviral options",
    "Show the antiviral demo options and sample costs",
    "show me the manufacturer resources",
    "what about the brand one?",
    "",
  ])("keeps %j locked", (text) => {
    expect(decideUnlock({ text }).unlock).toBe(false);
  });

  it("unlocks exactly one therapy for an unambiguous named request", () => {
    expect(decideUnlock({ text: `Show manufacturer resources for ${BRAND_NAME.toLowerCase()}` })).toEqual({
      unlock: true,
      therapyId: BRAND,
      reason: "named_therapy_request",
    });
  });

  it.each([
    `Show ${BRAND_NAME} options and sample costs`,
    `what does ${BRAND_NAME} cost at pharmacy A?`,
    BRAND_NAME,
  ])("keeps %j locked: naming a therapy without asking for its resources is not enough", (text) => {
    expect(decideUnlock({ text })).toEqual({
      unlock: false,
      reason: "That asked about a therapy, not its manufacturer resources. Resources remain locked.",
    });
  });

  // The clinician screen also works in Spanish. Fixture therapy names stay in English; the rule does not change.
  it("unlocks exactly one therapy for an unambiguous named request in Spanish", () => {
    expect(decideUnlock({ text: `Mostrar los recursos del fabricante de ${BRAND_NAME}` })).toEqual({
      unlock: true,
      therapyId: BRAND,
      reason: "named_therapy_request",
    });
  });

  it.each([
    "Mostrar las opciones antivirales de demostración y sus costos de ejemplo",
    "muéstreme los recursos del fabricante",
    "¿y la tarjeta de copago?",
  ])("keeps %j locked: a Spanish category or unnamed request unlocks nothing", (text) => {
    expect(decideUnlock({ text }).unlock).toBe(false);
  });

  it.each([
    `Mostrar las opciones de ${BRAND_NAME} y sus costos`,
    `¿cuánto cuesta ${BRAND_NAME} en la farmacia A?`,
  ])("keeps %j locked: naming a therapy in Spanish without asking for its resources is not enough", (text) => {
    expect(decideUnlock({ text })).toEqual({
      unlock: false,
      reason: "That asked about a therapy, not its manufacturer resources. Resources remain locked.",
    });
  });

  it("stays locked when more than one therapy is named", () => {
    const text = `manufacturer resources for ${fixtures.therapies.map((therapy) => therapy.name).join(" and ")}`;

    expect(decideUnlock({ text }).unlock).toBe(false);
  });

  it("stays locked for an unknown therapy ID", () => {
    expect(decideUnlock({ therapyId: "therapy-made-up" })).toEqual({
      unlock: false,
      reason: "Therapy not found in demo. Resources remain locked.",
    });
  });
});

describe("POST /api/encounters/:id/resources", () => {
  it("keeps a category request locked: no resources, no unlock, no audit event", async () => {
    const response = await ask("enc-1", { text: "show antiviral options" });
    const body = resourcesResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.unlocked).toBe(false);
    expect(JSON.stringify(body)).not.toContain("resource-demo");
    expect(unlocked()).toEqual([]);
    expect(auditEvents()).toEqual([]);
  });

  it("unlocks only the explicitly requested therapy, returns only its labelled resources, and audits it", async () => {
    const response = await ask("enc-1", { therapyId: BRAND });
    const body = resourcesResponseSchema.parse(await response.json());

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.unlocked && body.therapyId).toBe(BRAND);
    expect(body.unlocked && body.resources.map((resource) => resource.id)).toEqual([
      "resource-demo-copay",
      "resource-demo-education",
    ]);
    for (const resource of body.unlocked ? body.resources : []) {
      expect(resource.therapyId).toBe(BRAND);
      expect(resource.mockLabel).toBe("Manufacturer resource — fictional demo");
    }
    expect(unlocked()).toEqual([BRAND]);

    const [event] = auditEvents();
    expect(auditEvents()).toHaveLength(1);
    expect(event).toMatchObject({
      demoSessionId: SESSION_A,
      encounterId: "enc-1",
      action: "unlock_manufacturer_resources",
      therapyId: BRAND,
      resourceIds: ["resource-demo-copay", "resource-demo-education"],
      reason: "explicit_therapy_action",
    });
    expect(body.unlocked && body.auditEventId).toBe(event.id);
  });

  it("unlocks through an unambiguous typed request that names the therapy", async () => {
    const body = await (await ask("enc-1", { text: `show resources for ${BRAND_NAME}` })).json();

    expect(body.unlocked).toBe(true);
    expect(unlocked()).toEqual([BRAND]);
    expect(auditEvents()[0].reason).toBe("named_therapy_request");
  });

  it("does not duplicate the therapy ID on a repeated unlock, and audits the repeat as a view", async () => {
    await ask("enc-1", { therapyId: BRAND });
    const second = await (await ask("enc-1", { therapyId: BRAND })).json();

    expect(second.unlocked).toBe(true);
    expect(unlocked()).toEqual([BRAND]);
    expect(auditEvents().map((event) => event.action).sort()).toEqual([
      "unlock_manufacturer_resources",
      "view_unlocked_manufacturer_resources",
    ]);
  });

  it("unlocking one therapy never exposes another therapy's resources", async () => {
    const body = await (await ask("enc-1", { therapyId: GENERIC })).json();

    expect(body).toMatchObject({ unlocked: true, therapyId: GENERIC, resources: [] });
    expect(unlocked()).toEqual([GENERIC]);
  });

  it("stays locked with a not-found reason for an unknown therapy", async () => {
    const body = await (await ask("enc-1", { therapyId: "therapy-made-up" })).json();

    expect(body).toEqual({ unlocked: false, reason: "Therapy not found in demo. Resources remain locked." });
    expect(unlocked()).toEqual([]);
  });

  it("returns 404 for another session's encounter and leaves it untouched", async () => {
    await seed(SESSION_B, "enc-b");

    expect((await ask("enc-b", { therapyId: BRAND })).status).toBe(404);
    expect(unlocked(SESSION_B, "enc-b")).toEqual([]);
    expect(auditEvents()).toEqual([]);
  });

  it("refuses an emergency encounter", async () => {
    await seed(SESSION_A, "enc-emergency", { status: "emergency" });

    expect((await ask("enc-emergency", { therapyId: BRAND })).status).toBe(409);
  });

  it("returns nothing when the unlock cannot be recorded", async () => {
    vi.spyOn(fake.db, "putItem").mockRejectedValueOnce(new Error("write failed"));

    const response = await ask("enc-1", { therapyId: BRAND });

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("resource-demo");
  });

  it.each([{}, { text: "" }, { therapyId: "" }])("returns 400 for the invalid body %j", async (body) => {
    expect((await ask("enc-1", body)).status).toBe(400);
  });

  it("returns 401 without a valid session", async () => {
    requireSession.mockResolvedValue({ ok: false, response: Response.json({ error: "invalid_session" }, { status: 401 }) });

    expect((await ask("enc-1", { therapyId: BRAND })).status).toBe(401);
  });
});
