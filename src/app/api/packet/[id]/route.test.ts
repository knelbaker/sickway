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

import { packetDetailResponseSchema, samplePacketDetailResponse } from "@/lib/api-contracts";
import { packetViewSchema } from "@/lib/packet-view";
import { GET } from "./route";

const SESSION_A = "a".repeat(32);
const SESSION_B = "b".repeat(32);

const stored = {
  ...samplePacketDetailResponse,
  id: "pkt-1",
  demoSessionId: SESSION_A,
  therapyId: "therapy-generic-demo",
  pharmacyId: "pharmacy-demo-a",
  mockPrice: 12,
  instructionLanguages: ["es"],
  resourceIds: [],
};

const read = (id: string) => GET(new Request(`http://localhost/api/packet/${id}`), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  fake.db.items.clear();
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ ok: true, session: { id: SESSION_A } });
  await fake.db.putItem(SESSION_A, "PKT#pkt-1", { ...stored, ttl: 1790000000 });
});

describe("GET /api/packet/:id", () => {
  it("returns the stored packet in the contract shape plus labelled display text", async () => {
    const response = await read("pkt-1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(packetDetailResponseSchema.parse(body)).toEqual(stored);
    expect(packetViewSchema.parse(body).display).toMatchObject({
      patientName: "Alex Demo",
      therapyName: "Fictional Generic Antiviral Demo",
      generic: true,
      pharmacyName: "Fictional Demo Pharmacy A",
      coverageMockLabel: "Mock coverage — not verified",
      resources: [],
    });
    expect(body.ttl).toBeUndefined();
  });

  it("renders only the selected language, unchanged from the prewritten fixture copy", async () => {
    const { display } = packetViewSchema.parse(await (await read("pkt-1")).json());
    const { fixtures } = await import("@/lib/fixtures");

    expect(display.instructions).toHaveLength(1);
    expect(display.instructions[0]).toEqual({
      language: "es",
      mockLabel: fixtures.instructionsEs.mockLabel,
      ...fixtures.instructionsEs.therapies["therapy-generic-demo"],
    });
  });

  it("returns the price stored at attach time, not a recomputed one", async () => {
    await fake.db.putItem(SESSION_A, "PKT#pkt-old-price", { ...stored, id: "pkt-old-price", mockPrice: 9 });

    expect((await (await read("pkt-old-price")).json()).mockPrice).toBe(9);
  });

  it("includes only the resources attached to this packet, each with its fictional label", async () => {
    await fake.db.putItem(SESSION_A, "PKT#pkt-brand", {
      ...stored,
      id: "pkt-brand",
      therapyId: "therapy-brand-demo",
      mockPrice: 45,
      resourceIds: ["resource-demo-copay"],
    });

    const { display } = packetViewSchema.parse(await (await read("pkt-brand")).json());

    expect(display.resources.map((resource) => resource.id)).toEqual(["resource-demo-copay"]);
    expect(display.resources[0].mockLabel).toBe("Manufacturer resource — fictional demo");
  });

  it("returns 404 with no data for a packet that exists only in another session", async () => {
    await fake.db.putItem(SESSION_B, "PKT#pkt-b", { ...stored, id: "pkt-b", demoSessionId: SESSION_B });

    const response = await read("pkt-b");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "packet_not_found" });
  });

  it.each(["missing", "PKT#pkt-1", "a#b"])("returns 404 for the unknown or malformed id %j", async (id) => {
    expect((await read(id)).status).toBe(404);
  });

  it("returns 401 without a valid session and reads nothing", async () => {
    requireSession.mockResolvedValue({ ok: false, response: Response.json({ error: "invalid_session" }, { status: 401 }) });

    expect((await read("pkt-1")).status).toBe(401);
  });
});
