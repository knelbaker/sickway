import { describe, expect, it } from "vitest";
import { elapsedSinceOnset, routeIntake } from "@/lib/demo-routing";
import { RED_FLAG_KEYS } from "@/lib/red-flags";
import type { ReviewedIntake } from "@/lib/schemas";

const fixtureClock = "2026-09-19T08:00:00.000Z";
const intake: ReviewedIntake = {
  symptoms: ["fever", "body aches"],
  onsetIso: "2026-09-18T08:00:00.000Z",
  onsetConfirmed: true,
  maxTempF: 102,
  medsTaken: null,
  allergies: [],
  redFlags: {
    breathing_chest_pain: false,
    confusion_fainting: false,
    stiff_neck_rash: false,
    high_temperature: false,
    dehydration: false,
    sudden_severe_headache: false,
  },
  deadlineToday: "14:00 exam",
  transcript: "Synthetic student reports fever and body aches.",
};

describe("routeIntake demo routing result", () => {
  it("returns ready with no reasons when all six flags are false", () => {
    expect(routeIntake(intake)).toEqual({ branch: "ready", reasons: [] });
  });

  it.each(RED_FLAG_KEYS)("routes a positive %s to emergency", (flag) => {
    const result = routeIntake({
      ...intake,
      redFlags: { ...intake.redFlags, [flag]: true },
    });

    expect(result.branch).toBe("emergency");
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain(flag);
  });

  it.each(RED_FLAG_KEYS)("lists an unanswered %s for review", (flag) => {
    const result = routeIntake({
      ...intake,
      redFlags: { ...intake.redFlags, [flag]: null },
    });

    expect(result.branch).toBe("needs_review");
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain(flag);
    expect(result.reasons[0]).toMatch(/unanswered/i);
  });

  it("lists every unanswered item", () => {
    const result = routeIntake({
      ...intake,
      redFlags: Object.fromEntries(RED_FLAG_KEYS.map((flag) => [flag, null])),
    });

    expect(result.branch).toBe("needs_review");
    expect(result.reasons).toHaveLength(6);
    for (const flag of RED_FLAG_KEYS) {
      expect(result.reasons.some((reason) => reason.includes(flag))).toBe(true);
    }
  });

  it("keeps all positive reasons and gives emergency precedence over unknowns", () => {
    const result = routeIntake({
      ...intake,
      redFlags: {
        ...intake.redFlags,
        breathing_chest_pain: null,
        dehydration: true,
        sudden_severe_headache: true,
      },
    });

    expect(result.branch).toBe("emergency");
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons.join(" ")).toContain("dehydration");
    expect(result.reasons.join(" ")).toContain("sudden_severe_headache");
  });

  it("preserves emergency precedence even with outside-scenario and malformed fields", () => {
    const result = routeIntake({
      outsideScenario: true,
      redFlags: { dehydration: true, high_temperature: "false" },
    });

    expect(result.branch).toBe("emergency");
    expect(result.reasons.join(" ")).toContain("dehydration");
  });

  it("requires review for an explicit outside-scenario marker", () => {
    const result = routeIntake({ ...intake, outsideScenario: true });

    expect(result.branch).toBe("needs_review");
    expect(result.reasons.join(" ")).toMatch(/outside.*demo scenario/i);
  });

  it("accepts an explicit false outside-scenario marker", () => {
    expect(routeIntake({ ...intake, outsideScenario: false }).branch).toBe("ready");
  });

  it.each(Object.keys(intake))("identifies the missing required field %s", (field) => {
    const incomplete: Record<string, unknown> = { ...intake };
    delete incomplete[field];

    const result = routeIntake(incomplete);

    expect(result.branch).toBe("needs_review");
    expect(result.reasons.join(" ")).toContain(field);
  });

  it.each(RED_FLAG_KEYS)("does not treat a missing %s as false", (flag) => {
    const redFlags: Record<string, unknown> = { ...intake.redFlags };
    delete redFlags[flag];

    const result = routeIntake({ ...intake, redFlags });

    expect(result.branch).toBe("needs_review");
    expect(result.reasons.join(" ")).toContain(flag);
  });

  it.each(["true", "false", 0, 1, undefined, {}, []])(
    "requires review for a malformed flag value: %j",
    (answer) => {
      const result = routeIntake({
        ...intake,
        redFlags: { ...intake.redFlags, dehydration: answer },
      });

      expect(result.branch).toBe("needs_review");
      expect(result.reasons.join(" ")).toContain("redFlags.dehydration");
    },
  );

  it.each([
    null,
    undefined,
    "ready",
    [],
    {},
    { ...intake, redFlags: null },
    { ...intake, redFlags: [] },
    { ...intake, symptoms: "fever" },
    { ...intake, outsideScenario: "false" },
    { ...intake, status: "ready" },
    { ...intake, redFlags: { ...intake.redFlags, extra_flag: false } },
  ])("requires review with an explicit reason for unexpected input: %j", (input) => {
    const result = routeIntake(input);

    expect(result.branch).toBe("needs_review");
    expect(result.reasons.join(" ")).toMatch(/unexpected input/i);
  });

  it("does not add rules for temperature, onset confirmation, or other unknown fields", () => {
    expect(routeIntake({
      ...intake,
      maxTempF: 104,
      onsetIso: null,
      onsetConfirmed: false,
      medsTaken: null,
      allergies: null,
      deadlineToday: null,
    })).toEqual({ branch: "ready", reasons: [] });
  });

  it("does not mutate the reviewed intake or its unknown answers", () => {
    const reviewed = structuredClone(intake);
    reviewed.redFlags.dehydration = null;
    const before = structuredClone(reviewed);

    expect(routeIntake(reviewed)).toEqual(routeIntake(reviewed));
    expect(reviewed).toEqual(before);
  });
});

describe("elapsedSinceOnset", () => {
  it("returns elapsed hours with the reviewed onset and fixture-clock sources", () => {
    expect(elapsedSinceOnset(intake, fixtureClock)).toEqual({
      hours: 24,
      onsetIso: intake.onsetIso,
      fixtureClock,
      source: { onsetIso: "student_review", fixtureClock: "demo_fixture" },
    });
  });

  it("returns no elapsed time when onset is unconfirmed", () => {
    expect(elapsedSinceOnset({ ...intake, onsetConfirmed: false }, fixtureClock)).toBeNull();
  });

  it.each([null, "", "yesterday morning", "2026-09-18", "2026-09-18T08:00:00", "2026-02-30T08:00:00Z"])(
    "returns no elapsed time for missing, ambiguous, or invalid onset: %s",
    (onsetIso) => {
      expect(elapsedSinceOnset({ ...intake, onsetIso }, fixtureClock)).toBeNull();
    },
  );

  it.each(["", "invalid", "2026-09-19", "2026-09-19T08:00:00", "2026-02-30T08:00:00Z"])(
    "returns no elapsed time for an invalid fixture clock: %s",
    (clock) => {
      expect(elapsedSinceOnset(intake, clock)).toBeNull();
    },
  );

  it("returns no elapsed time if onset is after the fixture clock", () => {
    expect(elapsedSinceOnset(intake, "2026-09-17T08:00:00Z")).toBeNull();
  });

  it("preserves zero elapsed hours", () => {
    expect(elapsedSinceOnset({ ...intake, onsetIso: fixtureClock }, fixtureClock)?.hours).toBe(0);
  });

  it("uses explicit timezone offsets and preserves fractional hours", () => {
    expect(elapsedSinceOnset({
      ...intake,
      onsetIso: "2026-09-19T01:30:00-04:00",
    }, fixtureClock)?.hours).toBe(2.5);
  });

  it("uses the supplied clock on repeated calls without changing the intake", () => {
    const reviewed = structuredClone(intake);
    const before = structuredClone(reviewed);

    expect(elapsedSinceOnset(reviewed, fixtureClock)).toEqual(elapsedSinceOnset(reviewed, fixtureClock));
    expect(elapsedSinceOnset(reviewed, "2026-09-20T08:00:00Z")?.hours).toBe(48);
    expect(reviewed).toEqual(before);
  });
});
