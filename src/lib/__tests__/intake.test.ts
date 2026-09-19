// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateStructured = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai", () => ({ generateStructured }));

import { extractResponseSchema, sampleExtractRequest } from "@/lib/api-contracts";
import { extractIntake, OUTSIDE_SCENARIO_MESSAGE, suggestOnsetIso } from "@/lib/intake";

const CLOCK = "2026-09-19T10:00:00-04:00";
const SEEDED = sampleExtractRequest.text;

function modelReturns(data: Record<string, unknown>) {
  generateStructured.mockResolvedValue({
    ok: true,
    cached: false,
    data: {
      outsideScenario: false,
      symptoms: [],
      maxTempF: null,
      onsetPhrase: null,
      deadlineToday: null,
      medsMentioned: [],
      ...data,
    },
  });
}

beforeEach(() => {
  generateStructured.mockReset();
});

describe("suggestOnsetIso", () => {
  it.each([
    ["yesterday morning", "2026-09-18T08:00:00-04:00"],
    ["it started yesterday", "2026-09-18T12:00:00-04:00"],
    ["last night", "2026-09-18T22:00:00-04:00"],
    ["this morning", "2026-09-19T08:00:00-04:00"],
    ["two days ago in the evening", "2026-09-17T19:00:00-04:00"],
    ["3 hours ago", "2026-09-19T07:00:00-04:00"],
    ["an hour ago", "2026-09-19T09:00:00-04:00"],
  ])("maps %j relative to the fixture clock", (phrase, expected) => {
    expect(suggestOnsetIso(phrase, CLOCK)).toBe(expected);
  });

  it("crosses a month boundary using the fixture clock's own offset", () => {
    expect(suggestOnsetIso("yesterday evening", "2026-10-01T00:30:00-04:00")).toBe("2026-09-30T19:00:00-04:00");
  });

  it.each([null, "", "a while back", "since the weekend"])("returns null for the unclear phrase %j", (phrase) => {
    expect(suggestOnsetIso(phrase, CLOCK)).toBeNull();
  });

  it("never suggests a time after the fixture clock", () => {
    expect(suggestOnsetIso("this evening", CLOCK)).toBeNull();
  });

  it("returns null for a fixture clock without an explicit offset", () => {
    expect(suggestOnsetIso("yesterday morning", "2026-09-19T10:00:00")).toBeNull();
  });
});

describe("extractIntake", () => {
  it("returns candidate fields for the seeded sentence with an unconfirmed suggested onset", async () => {
    modelReturns({
      symptoms: ["fever", "whole body aches"],
      maxTempF: 102,
      onsetPhrase: "yesterday morning",
      deadlineToday: "exam at 2",
    });

    const result = await extractIntake("s1", SEEDED, CLOCK);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(extractResponseSchema.parse(result.response)).toEqual({
      outsideScenario: false,
      transcript: SEEDED,
      candidateFields: {
        symptoms: ["fever", "whole body aches"],
        maxTempF: 102,
        onsetPhrase: "yesterday morning",
        suggestedOnsetIso: "2026-09-18T08:00:00-04:00",
        deadlineToday: "exam at 2",
        medsMentioned: [],
      },
    });
  });

  it("keeps everything unreported as null for sparse input", async () => {
    modelReturns({ symptoms: ["feel sick"] });

    const result = await extractIntake("s1", "I feel sick", CLOCK);

    expect(result.ok && result.response.candidateFields).toEqual({
      symptoms: ["feel sick"],
      maxTempF: null,
      onsetPhrase: null,
      suggestedOnsetIso: null,
      deadlineToday: null,
      medsMentioned: [],
    });
  });

  it("drops a temperature the student never stated", async () => {
    modelReturns({ symptoms: ["fever"], maxTempF: 101 });

    const result = await extractIntake("s1", "I have a fever and chills", CLOCK);

    expect(result.ok && result.response.candidateFields?.maxTempF).toBeNull();
  });

  it("drops an implausible temperature even when the number appears", async () => {
    modelReturns({ symptoms: ["fever"], maxTempF: 2 });

    const result = await extractIntake("s1", "fever and an exam at 2", CLOCK);

    expect(result.ok && result.response.candidateFields?.maxTempF).toBeNull();
  });

  it("reflects a changed temperature instead of the seeded value", async () => {
    modelReturns({ symptoms: ["fever"], maxTempF: 100.4 });

    const result = await extractIntake("s1", "I have a 100.4 fever", CLOCK);

    expect(result.ok && result.response.candidateFields?.maxTempF).toBe(100.4);
  });

  it("flags unrelated input as outside the scenario with no candidate fields", async () => {
    modelReturns({ outsideScenario: true, symptoms: ["parking"] });

    const result = await extractIntake("s1", "Where do I park my car for the game?", CLOCK);

    expect(result.ok && extractResponseSchema.parse(result.response)).toEqual({
      outsideScenario: true,
      transcript: "Where do I park my car for the game?",
      message: OUTSIDE_SCENARIO_MESSAGE,
      candidateFields: null,
    });
  });

  it("returns a typed failure, never fixture data, when the model fails", async () => {
    generateStructured.mockResolvedValue({ ok: false, reason: "timeout" });

    await expect(extractIntake("s1", SEEDED, CLOCK)).resolves.toEqual({ ok: false, reason: "timeout" });
  });

  it("sends only the student's text, scoped to the caller's session", async () => {
    modelReturns({});

    await extractIntake("session-a", `  ${SEEDED}  `, CLOCK);

    const call = generateStructured.mock.calls[0][0];
    expect(call.sessionId).toBe("session-a");
    expect(call.prompt).toBe(`TEXT:\n${SEEDED}`);
    expect(call.system).toContain("Missing is not negative");
    expect(call.system).toContain("Do not extract a name, age, insurance");
  });
});
