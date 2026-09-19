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

import {
  encounterDetailResponseSchema,
  encountersQueueResponseSchema,
  sampleEncounterDetailResponse,
} from "@/lib/api-contracts";
import { GET as getQueue } from "./route";
import { GET as getDetail } from "./[id]/route";

const SESSION_A = "a".repeat(32);
const SESSION_B = "b".repeat(32);

function sessionIs(id: string) {
  requireSession.mockResolvedValue({ ok: true, session: { id } });
}

function noSession() {
  requireSession.mockResolvedValue({
    ok: false,
    response: Response.json({ error: "invalid_session" }, { status: 401 }),
  });
}

async function seed(sessionId: string, id: string, createdAt: string, changes: Record<string, unknown> = {}) {
  await fake.db.putItem(sessionId, `ENC#${id}`, {
    ...sampleEncounterDetailResponse,
    id,
    demoSessionId: sessionId,
    createdAt,
    ...changes,
    // Stored items carry a ttl the API must not leak into contract shapes.
    ttl: 1790000000,
  });
}

const queueRequest = () => new Request("http://localhost/api/encounters");
const detail = (id: string) =>
  getDetail(new Request(`http://localhost/api/encounters/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  fake.db.items.clear();
  vi.clearAllMocks();
  sessionIs(SESSION_A);
});

describe("GET /api/encounters", () => {
  it("returns an empty list with 200 for a session with no submissions", async () => {
    const response = await getQueue(queueRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual([]);
  });

  it("lists only this session's encounters, newest first, in the compact contract shape", async () => {
    await seed(SESSION_A, "enc-old", "2026-09-19T14:00:00.000Z");
    await seed(SESSION_A, "enc-new", "2026-09-19T14:05:00.000Z", { status: "needs_review" });
    await seed(SESSION_B, "enc-other", "2026-09-19T14:06:00.000Z");

    const body = encountersQueueResponseSchema.parse(await (await getQueue(queueRequest())).json());

    expect(body).toEqual([
      {
        id: "enc-new",
        createdAt: "2026-09-19T14:05:00.000Z",
        status: "needs_review",
        displayName: "Alex Demo",
        chiefSymptoms: ["fever", "body aches"],
      },
      {
        id: "enc-old",
        createdAt: "2026-09-19T14:00:00.000Z",
        status: "ready",
        displayName: "Alex Demo",
        chiefSymptoms: ["fever", "body aches"],
      },
    ]);
  });

  it("returns 401 without a valid session", async () => {
    noSession();

    expect((await getQueue(queueRequest())).status).toBe(401);
  });
});

describe("GET /api/encounters/:id", () => {
  it("returns the full encounter including the brief, sources, and unlocked therapies", async () => {
    await seed(SESSION_A, "enc-1", "2026-09-19T14:00:00.000Z");

    const response = await detail("enc-1");
    const body = encounterDetailResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.sbar?.source).toBe("prepared_fixture");
    expect(body.fieldSources.name).toBe("synthetic_profile");
    expect(body.unlockedTherapyIds).toEqual([]);
    expect(body.intake.medsTaken).toBeNull();
    expect(body.intake.allergies).toEqual([]);
  });

  it("returns 404 for an encounter that exists only in another session", async () => {
    await seed(SESSION_B, "enc-b", "2026-09-19T14:00:00.000Z");

    const response = await detail("enc-b");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "encounter_not_found" });
  });

  it.each(["missing", "ENC#enc-1", "a#b"])("returns 404 for the unknown or malformed id %j", async (id) => {
    await seed(SESSION_A, "enc-1", "2026-09-19T14:00:00.000Z");

    expect((await detail(id)).status).toBe(404);
  });

  it("returns 401 without a valid session and reads nothing", async () => {
    await seed(SESSION_A, "enc-1", "2026-09-19T14:00:00.000Z");
    noSession();

    expect((await detail("enc-1")).status).toBe(401);
  });
});
