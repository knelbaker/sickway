// @vitest-environment jsdom
// Issue #87: help a student say it, keep their words beside the summary, and never pretend to translate.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BriefView } from "@/components/hcp/brief-view";
import { StudentFlow } from "@/components/student/student-flow";
import { sampleExtractResponse, sampleIntakeRequest } from "@/lib/api-contracts";
import { MESSAGES } from "@/lib/i18n/messages";

const profile = {
  name: "Alex Demo",
  age: 20,
  planName: "Fictional Demo Out-of-State PPO",
  planMockLabel: "Mock coverage — not verified",
  instructionLanguages: ["en", "es"],
  costCeiling: 25,
  fixtureClock: "2026-09-19T10:00:00-04:00",
};
const SPANISH = "Tengo fiebre y me duele todo el cuerpo desde ayer por la mañana.";

beforeEach(() => window.localStorage.setItem("sickday.demoSessionToken", "session.token"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("guided expression", () => {
  test("the prompts are reading material: opening them changes nothing the student typed, or did not type", () => {
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    const box = screen.getByLabelText("What is going on today?") as HTMLTextAreaElement;
    const help = screen.getByText("Not sure how to say it? Three questions can help").closest("details") as HTMLDetailsElement;

    // Every prompt is there, and none of them is a control that could write into the box.
    for (const prompt of MESSAGES.en.describe.prompts) expect(within(help).getByText(prompt)).toBeDefined();
    expect(within(help).queryAllByRole("button")).toHaveLength(0);

    fireEvent.click(within(help).getByText("Not sure how to say it? Three questions can help"));
    expect(box.value).toBe("");

    // A blank description stays blank: Continue does not proceed with an example in its place.
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    expect(box.value).toBe("");
  });

  test("says, where the student types, that their words are not translated, in both languages", () => {
    expect(MESSAGES.en.describe.ownWords).toContain("does not translate");
    expect(MESSAGES.es.describe.ownWords).toContain("no traduce");
    expect(MESSAGES.es.describe.prompts).toHaveLength(MESSAGES.en.describe.prompts.length);
  });
});

describe("the student's own words", () => {
  test("the review step shows what the student wrote, unchanged, above the extracted details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ...sampleExtractResponse, transcript: SPANISH })),
    );
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    fireEvent.change(screen.getByLabelText("What is going on today?"), { target: { value: SPANISH } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("1. Are any of these happening?");
    fireEvent.click(screen.getByRole("button", { name: "Continue to review" }));
    await screen.findByText("Review before sharing");

    const words = screen.getByText("What you wrote").closest("figure") as HTMLElement;
    expect(within(words).getByText(`“${SPANISH}”`)).toBeDefined();
    expect(words.textContent).toContain("Your words are not translated");
  });

  test("the clinician's brief keeps those words beside it and says nothing was translated", () => {
    const sbar = { situation: "s", background: "b", assessment: "a", recommendation: "r", spokenScript: "s", source: "deterministic" as const };
    render(<BriefView sbar={sbar} words={SPANISH} />);

    const words = screen.getByText("In the student's own words").closest("figure") as HTMLElement;
    // Exactly as written: a Spanish sentence stays Spanish in an English brief.
    expect(within(words).getByText(`“${SPANISH}”`)).toBeDefined();
    const notice = within(words).getByRole("note").textContent ?? "";
    expect(notice).toContain("Nothing in this demo is translated");
    expect(notice).toContain("do not show that a language gap has been resolved");
  });

  test("an intake with no typed description says so instead of showing nothing", () => {
    const sbar = { situation: "s", background: "b", assessment: "a", recommendation: "r", spokenScript: "s", source: "prepared_fixture" as const };
    render(<BriefView sbar={sbar} words={null} />);
    expect(screen.getByText("The student did not type a description.")).toBeDefined();
  });
});

describe("claims", () => {
  test("neither language promises translation, measured impact, or proven outcomes", () => {
    for (const language of ["en", "es"] as const) {
      const text = JSON.stringify(MESSAGES[language].landing, (_key, value) => (typeof value === "function" ? "" : value));
      expect(text).not.toMatch(/we translate|translates your|traducimos|traduce sus|proven|demostrado que|reduces disparit|reduce las desigualdades|\d+ ?%/i);
    }
    // The hoped-for benefit is labelled as unmeasured, in both languages.
    expect(MESSAGES.en.landing.why[2].title).toContain("have not measured");
    expect(MESSAGES.es.landing.why[2].title).toContain("no hemos medido");
  });
});
