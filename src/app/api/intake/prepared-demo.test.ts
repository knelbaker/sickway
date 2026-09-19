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
import { fixtures } from "@/lib/fixtures";
import { encounterSchema } from "@/lib/schemas";
import { matchesPreparedScript } from "@/lib/voice";
import { POST } from "./route";

const session = { id: "a".repeat(32), profileId: "demo-student-01" as const, fixtureClock: fixtures.profile.fixtureClock, createdAt: "2026-09-19T12:00:00.000Z", ttl: 1790000000 };
const post = (body: unknown) => POST(new Request("http://localhost/api/intake", { method: "POST", body: JSON.stringify(body) }));
const stored = () => [...fake.db.items.values()].map((item) => encounterSchema.parse(item));

beforeEach(() => {
  fake.db.items.clear();
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ ok: true, session });
  generateStructured.mockResolvedValue({ ok: false, reason: "provider_error" });
});

describe("explicit prepared demo", () => {
  it("stores the fixture case and brief, labelled as fixture output, without calling the model", async () => {
    const response = await post({ usePreparedDemo: true, consent: { shareWithClinic: true } });

    expect(response.status).toBe(201);
    const [encounter] = stored();
    expect(encounter.intake).toEqual(fixtures.profile.intake);
    expect(encounter.sbar).toEqual(fixtures.brief.sbar);
    expect(encounter.sbar?.source).toBe("prepared_fixture");
    expect(encounter.status).toBe("ready");
    expect(encounter.fieldSources).toMatchObject({
      symptoms: "demo_fixture",
      redFlags: "demo_fixture",
      onsetConfirmed: "demo_fixture",
      transcript: "demo_fixture",
      name: "synthetic_profile",
    });
    expect(Object.values(encounter.fieldSources)).not.toContain("student_review");
    expect(generateStructured).not.toHaveBeenCalled();
    // This is the one case whose audio may use the prepared recording.
    expect(matchesPreparedScript(encounter.sbar!.spokenScript, fixtures.brief.sbar.spokenScript)).toBe(true);
  });

  it("ignores any intake sent alongside the flag: the server uses the fixture", async () => {
    await post({
      usePreparedDemo: true,
      intake: { ...sampleIntakeRequest.intake, symptoms: ["something else"], maxTempF: 99 },
      consent: { shareWithClinic: true },
    });

    expect(stored()[0].intake).toEqual(fixtures.profile.intake);
  });

  it.each([
    ["false", { usePreparedDemo: true, consent: { shareWithClinic: false } }],
    ["missing", { usePreparedDemo: true }],
  ])("still requires explicit consent (%s) and stores nothing without it", async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "consent_required" });
    expect(fake.db.items.size).toBe(0);
  });
});

describe("no silent substitution", () => {
  it.each([
    ["the exact seeded intake", fixtures.profile.intake],
    ["a changed symptom", { ...fixtures.profile.intake, symptoms: ["sore throat"], maxTempF: 100.4 }],
  ])("a model failure with %s yields a deterministic brief for that input, never the prepared fixture", async (_label, intake) => {
    await post({ intake, consent: { shareWithClinic: true } });

    const [encounter] = stored();
    expect(encounter.sbar?.source).toBe("deterministic");
    expect(encounter.fieldSources.symptoms).toBe("student_review");
    expect(matchesPreparedScript(encounter.sbar!.spokenScript, fixtures.brief.sbar.spokenScript)).toBe(false);
    expect(encounter.sbar?.situation).toContain(String(intake.maxTempF));
  });

  it.each([{ usePreparedDemo: "true" }, { usePreparedDemo: 1 }, { usePreparedDemo: false }])(
    "does not treat %j as the explicit choice",
    async (flag) => {
      await post({ ...flag, ...sampleIntakeRequest });

      expect(stored()[0].sbar?.source).not.toBe("prepared_fixture");
      expect(stored()[0].intake).toEqual(sampleIntakeRequest.intake);
    },
  );
});
