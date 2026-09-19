// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeDb } from "@/lib/__tests__/helpers/fake-db";

vi.mock("server-only", () => ({}));

const { fake, requireSession, generateStructured } = vi.hoisted(() => ({
  fake: { db: undefined as unknown as FakeDb },
  requireSession: vi.fn(),
  generateStructured: vi.fn(),
}));

vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("@/lib/__tests__/helpers/fake-db");
  return (fake.db = createFakeDb());
});
vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("@/lib/ai", () => ({ generateStructured }));

import { sampleIntakeRequest } from "@/lib/api-contracts";
import { encounterSchema } from "@/lib/schemas";
import { RED_FLAG_DEFINITIONS, RED_FLAG_KEYS } from "@/lib/red-flags";
import { POST } from "./route";

const session = {
  id: "a".repeat(32),
  profileId: "demo-student-01" as const,
  fixtureClock: "2026-09-19T10:00:00-04:00",
  createdAt: "2026-09-19T12:00:00.000Z",
  ttl: 1790000000,
};

const generated = {
  situation: "Alex Demo, age 20, reports fever and body aches.",
  background: "Medications are not reported. Allergies: none reported. Coverage is mock, not verified.",
  assessment: "Demo routing result: routine campus clinic demo. This is not a diagnosis.",
  recommendation: "Review the synthetic intake with the demo clinic. Booking is not connected.",
  spokenScript: "Alex Demo reports fever and body aches. Booking is not connected.",
};

function post(body: unknown) {
  return new Request("http://localhost/api/intake", { method: "POST", body: JSON.stringify(body) });
}

function withIntake(changes: Record<string, unknown>) {
  return { ...sampleIntakeRequest, intake: { ...sampleIntakeRequest.intake, ...changes } };
}

function storedEncounters() {
  return [...fake.db.items.entries()]
    .filter(([key]) => key.includes("|ENC#"))
    .map(([key, item]) => ({ key, encounter: encounterSchema.parse(item) }));
}

beforeEach(() => {
  fake.db.items.clear();
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ ok: true, session });
  generateStructured.mockResolvedValue({ ok: true, data: generated, cached: false });
});

describe("POST /api/intake", () => {
  it("stores a consented intake in the caller's session with sources and a generated brief", async () => {
    const response = await POST(post(sampleIntakeRequest));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.status).toBe("ready");

    const [{ key, encounter }] = storedEncounters();
    expect(key).toBe(`${session.id}|ENC#${body.encounterId}`);
    expect(encounter).toMatchObject({
      id: body.encounterId,
      demoSessionId: session.id,
      profileId: "demo-student-01",
      status: "ready",
      intake: sampleIntakeRequest.intake,
      unlockedTherapyIds: [],
    });
    expect(encounter.consent.shareWithClinic).toBe(true);
    expect(Date.parse(encounter.consent.capturedAt)).not.toBeNaN();
    expect(encounter.sbar?.source).toBe("generated");
    expect(encounter.fieldSources).toMatchObject({
      symptoms: "student_review",
      redFlags: "student_review",
      onsetConfirmed: "student_review",
      name: "synthetic_profile",
      plan: "synthetic_profile",
    });
    expect(encounter.packetId).toBeUndefined();
  });

  it.each([
    ["false", { ...sampleIntakeRequest, consent: { shareWithClinic: false } }],
    ["missing", { intake: sampleIntakeRequest.intake }],
    ["a truthy string", { ...sampleIntakeRequest, consent: { shareWithClinic: "true" } }],
    ["not an object", null],
  ])("stores nothing and returns consent_required when consent is %s", async (_label, body) => {
    const response = await POST(post(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "consent_required" });
    expect(fake.db.items.size).toBe(0);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("stores needs_review for an unanswered checklist item even if the client claims ready", async () => {
    const body = {
      ...withIntake({ redFlags: { ...sampleIntakeRequest.intake.redFlags, dehydration: null } }),
      status: "ready",
    };
    generateStructured.mockResolvedValue({ ok: false, reason: "timeout" });

    const response = await POST(post(body));

    expect((await response.json()).status).toBe("needs_review");
    const [{ encounter }] = storedEncounters();
    expect(encounter.status).toBe("needs_review");
    expect(encounter.intake.redFlags.dehydration).toBeNull();
    expect(encounter.sbar?.assessment).toContain("Not answered: Dehydration");
  });

  it.each(RED_FLAG_DEFINITIONS)("stores an emergency SBAR for yes to $key even when generation fails", async ({ key, label }) => {
    generateStructured.mockResolvedValue({ ok: false, reason: "timeout" });
    const response = await POST(
      post(withIntake({ symptoms: ["dizziness"], redFlags: { ...sampleIntakeRequest.intake.redFlags, [key]: true } })),
    );

    expect(response.status).toBe(201);
    expect((await response.json()).status).toBe("emergency");
    const [{ encounter }] = storedEncounters();
    expect(encounter.status).toBe("emergency");
    expect(encounter.sbar?.source).toBe("deterministic");
    expect(encounter.sbar?.situation).toContain("dizziness");
    expect(encounter.sbar?.assessment).toContain(`Answered yes: ${label}`);
    expect(encounter.sbar?.spokenScript).toContain(label);
    expect(encounter.sbar?.recommendation).toContain("routine demo flow is bypassed");
  });

  it.each([true, null])("summarizes all checklist answers set to %s without inventing any no answers", async (answer) => {
    generateStructured.mockResolvedValue({ ok: false, reason: "timeout" });
    const response = await POST(post(withIntake({
      redFlags: Object.fromEntries(RED_FLAG_KEYS.map((key) => [key, answer])),
    })));

    expect(response.status).toBe(201);
    const [{ encounter }] = storedEncounters();
    expect(encounter.status).toBe(answer === true ? "emergency" : "needs_review");
    for (const { label } of RED_FLAG_DEFINITIONS) {
      expect(encounter.sbar?.assessment).toContain(label);
      expect(encounter.sbar?.spokenScript).toContain(label);
    }
    expect(encounter.sbar?.assessment).not.toContain("answered no");
  });

  it("stores a deterministic brief for the current input when the model fails", async () => {
    generateStructured.mockResolvedValue({ ok: false, reason: "provider_error" });

    await POST(post(withIntake({ maxTempF: 100.4 })));

    const [{ encounter }] = storedEncounters();
    expect(encounter.sbar?.source).toBe("deterministic");
    expect(encounter.sbar?.situation).toContain("100.4°F");
  });

  it("keeps unanswered and explicitly-none answers distinct in storage", async () => {
    await POST(post(withIntake({ medsTaken: null, allergies: [] })));

    const [{ encounter }] = storedEncounters();
    expect(encounter.intake.medsTaken).toBeNull();
    expect(encounter.intake.allergies).toEqual([]);
  });

  it("rejects an intake that is missing a checklist key and names the field", async () => {
    const { dehydration: _omitted, ...redFlags } = sampleIntakeRequest.intake.redFlags;
    void _omitted;

    const response = await POST(post(withIntake({ redFlags })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_intake", fields: ["intake.redFlags.dehydration"] });
    expect(fake.db.items.size).toBe(0);
  });

  it("rejects a request without a valid session before reading the body", async () => {
    requireSession.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "invalid_session" }, { status: 401 }),
    });

    const response = await POST(post(sampleIntakeRequest));

    expect(response.status).toBe(401);
    expect(fake.db.items.size).toBe(0);
  });

  it("stores the student's instruction-language preference and records it as theirs", async () => {
    await POST(post({ ...sampleIntakeRequest, preferredInstructionLanguages: ["es"] }));

    const [{ encounter }] = storedEncounters();
    expect(encounter.preferredInstructionLanguages).toEqual(["es"]);
    expect(encounter.fieldSources.instructionLanguages).toBe("student_review");
  });

  it("leaves the preference absent, and the profile as its source, when the student did not choose", async () => {
    await POST(post(sampleIntakeRequest));

    const [{ encounter }] = storedEncounters();
    expect(encounter.preferredInstructionLanguages).toBeUndefined();
    expect(encounter.fieldSources.instructionLanguages).toBe("synthetic_profile");
  });

  it.each([[[]], [["fr"]], [["es", "es"]], ["es"]])("rejects the invalid language preference %j", async (preferredInstructionLanguages) => {
    const response = await POST(post({ ...sampleIntakeRequest, preferredInstructionLanguages }));

    expect(response.status).toBe(400);
    expect(fake.db.items.size).toBe(0);
  });

  it("creates a separate encounter for each submission", async () => {
    const first = await (await POST(post(sampleIntakeRequest))).json();
    const second = await (await POST(post(sampleIntakeRequest))).json();

    expect(first.encounterId).not.toBe(second.encounterId);
    expect(storedEncounters()).toHaveLength(2);
  });
});
