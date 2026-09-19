// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateStructured = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai", () => ({ generateStructured }));

import { routeIntake } from "@/lib/demo-routing";
import { fixtures } from "@/lib/fixtures";
import { sbarSchema, type ReviewedIntake } from "@/lib/schemas";
import {
  buildSbar,
  deterministicSbar,
  generateSbar,
  preparedSbar,
  sbarFacts,
  sbarGuardrailViolation,
} from "@/lib/sbar";

const profile = fixtures.profile;
const seeded: ReviewedIntake = profile.intake;

function intakeWith(changes: Partial<ReviewedIntake>): ReviewedIntake {
  return { ...seeded, ...changes };
}

const generated = {
  situation: "Alex Demo, age 20, reports fever and whole-body aches with an exam at 2 PM.",
  background: "Onset confirmed by the student. Medications and allergies are not reported. Coverage is mock, not verified.",
  assessment: "Demo routing result: routine campus clinic demo. This is not a diagnosis.",
  recommendation: "Review the synthetic intake with the demo clinic. Booking is not connected.",
  spokenScript: "Alex Demo reports fever and whole-body aches. Medications and allergies are not reported. Booking is not connected.",
};

function allText(sbar: Record<string, string>) {
  return Object.values(sbar).join(" ");
}

beforeEach(() => {
  generateStructured.mockReset();
});

describe("sbarFacts", () => {
  it("renders every gap as not reported and keeps explicit none distinct", () => {
    const facts = sbarFacts(
      intakeWith({ allergies: null, medsTaken: [], maxTempF: null, deadlineToday: null, symptoms: [] }),
      profile,
      { branch: "ready", reasons: [] },
    );

    expect(facts.allergies).toBe("not reported");
    expect(facts.medicationsTaken).toBe("none reported");
    expect(facts.maxTemperature).toBe("not reported");
    expect(facts.deadlineToday).toBe("not reported");
    expect(facts.symptoms).toBe("not reported");
    expect(facts.coverage).toContain("not verified");
  });

  it("supplies the next step as fixed wording from the routing rules", () => {
    const flagged = intakeWith({ redFlags: { ...seeded.redFlags, dehydration: null } });

    expect(sbarFacts(seeded, profile, routeIntake(seeded)).nextStep).toBe(
      "Review the synthetic intake with the demo clinic. Booking is not connected.",
    );
    expect(sbarFacts(flagged, profile, routeIntake(flagged)).nextStep).toContain(
      "Review the unanswered or unexpected items with the student before continuing",
    );
  });

  it("states elapsed time only for a confirmed onset", () => {
    const routing = { branch: "ready" as const, reasons: [] };

    expect(sbarFacts(seeded, profile, routing).onset).toContain("26 hours before the displayed fixture clock");
    expect(sbarFacts(intakeWith({ onsetConfirmed: false }), profile, routing).onset).toBe(
      "reported but not confirmed by the student",
    );
    expect(sbarFacts(intakeWith({ onsetIso: null, onsetConfirmed: false }), profile, routing).onset).toBe(
      "not reported",
    );
  });
});

describe("deterministicSbar", () => {
  it("is schema-valid, labelled deterministic, and reflects the current input", () => {
    const intake = intakeWith({ maxTempF: 100.4, symptoms: ["sore throat"] });
    const sbar = deterministicSbar(intake, profile, routeIntake(intake));

    expect(sbarSchema.parse(sbar).source).toBe("deterministic");
    expect(sbar.situation).toContain("100.4°F");
    expect(sbar.situation).toContain("sore throat");
    expect(allText(sbar)).not.toContain("102");
  });

  it("never turns unanswered allergies or medications into a negative", () => {
    const intake = intakeWith({ allergies: null, medsTaken: null });
    const text = allText(deterministicSbar(intake, profile, routeIntake(intake)));

    expect(text).toContain("Allergies: not reported");
    expect(text).toContain("Medications taken: not reported");
    expect(text).not.toMatch(/no known allerg/i);
  });

  it("lists unanswered checklist items instead of a clean result", () => {
    const intake = intakeWith({ redFlags: { ...seeded.redFlags, dehydration: null } });
    const sbar = deterministicSbar(intake, profile, routeIntake(intake));

    expect(sbar.assessment).toContain("needs review");
    expect(sbar.assessment).toContain("Not answered: Dehydration or unable to keep liquids down.");
    expect(sbar.assessment).toContain("All other checklist items were answered no.");
    expect(sbar.assessment).not.toContain("answered no by the student");
  });

  it("describes the emergency branch without a routine next step", () => {
    const intake = intakeWith({ redFlags: { ...seeded.redFlags, breathing_chest_pain: true } });
    const sbar = deterministicSbar(intake, profile, routeIntake(intake));

    expect(sbar.assessment).toContain("emergency branch");
    expect(sbar.recommendation).toContain("routine demo flow is bypassed");
  });

  it("contains no therapy, manufacturer, or verified-coverage claim", () => {
    const sbar = deterministicSbar(seeded, profile, routeIntake(seeded));

    expect(sbarGuardrailViolation(sbar, seeded)).toBeNull();
  });
});

describe("sbarGuardrailViolation", () => {
  it("accepts a compliant generated brief", () => {
    expect(sbarGuardrailViolation(generated, seeded)).toBeNull();
  });

  it.each([
    ["a therapy name", { recommendation: `Consider ${fixtures.therapies[1].name}.` }, "mentions a therapy"],
    ["a verified-coverage claim", { background: "Insurance coverage was verified for this visit." }, "makes a forbidden claim"],
    ["an invented allergy negative", { background: "No known drug allergies." }, "invents a negative for allergies"],
    ["an invented medication negative", { background: "Patient denies medications." }, "invents a negative for medications"],
  ])("rejects %s", (_label, changes, reason) => {
    expect(sbarGuardrailViolation({ ...generated, ...changes }, seeded)).toBe(reason);
  });

  it.each([true, null])("rejects 'no red flags' when a checklist item is %s", (answer) => {
    const intake = intakeWith({ redFlags: { ...seeded.redFlags, dehydration: answer } });

    expect(sbarGuardrailViolation({ ...generated, assessment: "No red flags." }, intake)).toBe(
      "invents a clean checklist",
    );
  });
});

describe("generateSbar", () => {
  it.each([true, null])("falls back when a generated brief omits a checklist answer of %s", async (answer) => {
    const intake = intakeWith({ redFlags: { ...seeded.redFlags, dehydration: answer } });
    generateStructured.mockResolvedValue({ ok: true, data: generated, cached: false });

    const brief = await buildSbar({ sessionId: "s1", intake, profile, routing: routeIntake(intake) });
    expect(brief.source).toBe("deterministic");
    expect(brief.assessment).toContain("Dehydration or unable to keep liquids down");
    expect(brief.spokenScript).toContain("Dehydration or unable to keep liquids down");
  });

  it("accepts a generated emergency brief that preserves positive and unknown answers", async () => {
    const intake = intakeWith({
      symptoms: ["dizziness"],
      redFlags: { ...seeded.redFlags, confusion_fainting: true, dehydration: null },
    });
    const routing = routeIntake(intake);
    const { source: _source, ...draft } = deterministicSbar(intake, profile, routing);
    void _source;
    generateStructured.mockResolvedValue({ ok: true, data: draft, cached: false });

    const brief = await buildSbar({ sessionId: "s1", intake, profile, routing });
    expect(brief.source).toBe("generated");
    expect(brief.situation).toContain("dizziness");
    expect(brief.assessment).toContain("Answered yes: Confusion or fainting");
    expect(brief.assessment).toContain("Not answered: Dehydration");
  });

  it("returns a generated brief and sends only pre-rendered facts to the model", async () => {
    generateStructured.mockResolvedValue({ ok: true, data: generated, cached: false });

    const sbar = await generateSbar("s1", seeded, profile, routeIntake(seeded));

    expect(sbarSchema.parse(sbar).source).toBe("generated");
    const call = generateStructured.mock.calls[0][0];
    expect(call.sessionId).toBe("s1");
    expect(call.prompt).toContain('"allergies": "not reported"');
    expect(call.system).toContain("Never turn it into a negative");
    expect(call.system).toContain("restate FACTS.nextStep in full");
    expect(call.system).toContain("use FACTS.checklistSummary word for word");
    expect(call.promptVersion).toBe("sbar-v3");
  });

  it("returns null when generation fails", async () => {
    generateStructured.mockResolvedValue({ ok: false, reason: "timeout" });

    await expect(generateSbar("s1", seeded, profile, routeIntake(seeded))).resolves.toBeNull();
  });

  it("returns null when the generated text breaks a guardrail", async () => {
    generateStructured.mockResolvedValue({
      ok: true,
      data: { ...generated, background: "No known allergies." },
      cached: false,
    });

    await expect(generateSbar("s1", seeded, profile, routeIntake(seeded))).resolves.toBeNull();
  });
});

describe("buildSbar", () => {
  it("falls back to a deterministic brief for the current input when the model fails", async () => {
    generateStructured.mockResolvedValue({ ok: false, reason: "provider_error" });
    const intake = intakeWith({ maxTempF: 99.9 });

    const sbar = await buildSbar({ sessionId: "s1", intake, profile, routing: routeIntake(intake) });

    expect(sbar.source).toBe("deterministic");
    expect(sbar.situation).toContain("99.9°F");
  });

  it("never returns the prepared fixture without the explicit flag, even for the seeded case", async () => {
    generateStructured.mockResolvedValue({ ok: false, reason: "provider_error" });

    const sbar = await buildSbar({ sessionId: "s1", intake: seeded, profile, routing: routeIntake(seeded) });

    expect(sbar.source).not.toBe("prepared_fixture");
  });

  it("returns the prepared fixture only on explicit request and skips the model", async () => {
    const sbar = await buildSbar({
      sessionId: "s1",
      intake: seeded,
      profile,
      routing: routeIntake(seeded),
      usePrepared: true,
    });

    expect(sbar).toEqual(preparedSbar());
    expect(sbar.source).toBe("prepared_fixture");
    expect(generateStructured).not.toHaveBeenCalled();
  });
});
