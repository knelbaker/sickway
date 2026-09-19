import { describe, expect, it } from "vitest";
import { fixtures, parseFixtures, type Fixtures } from "@/lib/fixtures";

describe("synthetic fixture catalog", () => {
  it("loads all eight files with both instruction languages for every therapy", () => {
    expect(Object.keys(fixtures)).toHaveLength(8);
    const ids = fixtures.therapies.map((row) => row.id).sort();
    expect(Object.keys(fixtures.instructionsEn.therapies).sort()).toEqual(ids);
    expect(Object.keys(fixtures.instructionsEs.therapies).sort()).toEqual(ids);
    expect(fixtures.profile.instructionLanguages).toEqual(["en", "es"]);
  });

  const brokenReferences: [string, (data: Fixtures) => void][] = [
    ["profile plan", (data) => { data.profile.planId = "missing"; }],
    ["profile pharmacy", (data) => { data.profile.preferredPharmacyId = "missing"; }],
    ["formulary therapy", (data) => { data.plans[0].formulary[0].therapyId = "missing"; }],
    ["pharmacy therapy", (data) => { data.pharmacies[0].prices[0].therapyId = "missing"; }],
    ["pharmacy plan", (data) => { data.pharmacies[0].prices[0].planId = "missing"; }],
    ["therapy resource", (data) => { data.therapies[1].resourceIds[0] = "missing"; }],
    ["resource therapy", (data) => { data.resources[0].therapyId = "missing"; }],
    ["resource ownership", (data) => { data.resources[0].therapyId = data.therapies[0].id; }],
    ["EN therapy", (data) => { delete data.instructionsEn.therapies[data.therapies[0].id]; }],
    ["ES therapy", (data) => { delete data.instructionsEs.therapies[data.therapies[0].id]; }],
    ["duplicate ID", (data) => { data.pharmacies[1].id = data.pharmacies[0].id; }],
    ["missing formulary entry", (data) => { data.plans[0].formulary.pop(); }],
    ["missing pharmacy price", (data) => { data.pharmacies[0].prices.pop(); }],
    ["brief version", (data) => { data.brief.fixtureVersion = "different-case"; }],
  ];
  it.each(brokenReferences)("rejects broken %s", (_label, mutate) => {
    const data = structuredClone(fixtures);
    mutate(data);
    expect(() => parseFixtures(data)).toThrow();
  });

  it("rejects dorm fields, ambiguous onset, future onset, and unlabelled prices", () => {
    expect(() => parseFixtures({ ...fixtures, profile: { ...fixtures.profile, dorm: "demo" } })).toThrow();
    for (const onsetIso of ["yesterday morning", "2026-09-20T08:00:00-04:00"]) {
      const data = structuredClone(fixtures);
      data.profile.intake.onsetIso = onsetIso;
      expect(() => parseFixtures(data)).toThrow();
    }
    const data = structuredClone(fixtures);
    Reflect.deleteProperty(data.pharmacies[0].prices[0], "costMock");
    expect(() => parseFixtures(data)).toThrow();
  });

  it("keeps the prepared brief grounded in the explicitly scripted Scene 1 case", () => {
    const { profile, brief } = fixtures;
    expect(profile).not.toHaveProperty("dorm");
    expect(profile).not.toHaveProperty("consent");
    expect(profile.intake).toMatchObject({
      symptoms: ["fever", "whole-body aches"],
      maxTempF: 102,
      onsetConfirmed: true,
      medsTaken: null,
      allergies: null,
      deadlineToday: "Exam at 2 PM",
      transcript: "I woke up with a 102 fever, my whole body aches, it started yesterday morning, and I have an exam at 2.",
    });
    expect(Object.values(profile.intake.redFlags)).toEqual(Array(6).fill(false));
    expect(Date.parse(profile.fixtureClock) - Date.parse(profile.intake.onsetIso)).toBe(26 * 60 * 60 * 1000);
    expect(brief.sbar.spokenScript).toBe("Alex Demo, age twenty, reports fever to 102 degrees and whole-body aches, with an exam at two. Confirmed onset was twenty-six hours before the fixture clock. Scripted checklist responses are negative; medications and allergies are not reported. Demo routing indicates campus clinic review. Coverage is mock and unverified. Booking is not connected.");
    expect(brief.sbar.spokenScript.split(/\s+/).length).toBeGreaterThanOrEqual(50);
    expect(brief.sbar.spokenScript.split(/\s+/).length).toBeLessThanOrEqual(65);
  });
});
