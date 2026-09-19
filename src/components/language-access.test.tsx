import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VisitPanel } from "@/components/hcp/visit-panel";
import { LanguageSelector } from "@/components/language-selector";
import { NoticeEquivalent } from "@/components/notice-equivalent";
import { PacketView } from "@/components/packet/packet-view";
import { SiteHeader } from "@/components/site-header";
import { StudentFlow } from "@/components/student/student-flow";
import { SyntheticBanner } from "@/components/synthetic-banner";
import { sampleEncounterDetailResponse, sampleExtractRequest, sampleExtractResponse, sampleIntakeRequest, samplePacketDetailResponse } from "@/lib/api-contracts";
import { getLanguage, setLanguage } from "@/lib/client/language-store";
import { setSessionToken } from "@/lib/client/session-store";
import { MESSAGES } from "@/lib/i18n/messages";

const SESSION_A = `${"a".repeat(32)}.signature`;
const SESSION_B = `${"b".repeat(32)}.signature`;
const profile = {
  name: "Alex Demo",
  age: 20,
  planName: "Fictional Demo Out-of-State PPO",
  planMockLabel: "Mock coverage — not verified",
  instructionLanguages: ["en", "es"],
  costCeiling: 25,
  fixtureClock: "2026-09-19T10:00:00-04:00",
};

let intakeBodies: Record<string, unknown>[];
let extractReply: () => Response;

beforeEach(() => {
  intakeBodies = [];
  extractReply = () => Response.json(sampleExtractResponse);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === "/api/extract") return extractReply();
      if (path === "/api/intake") {
        intakeBodies.push(JSON.parse(String(init?.body)));
        return Response.json({ encounterId: "e1", status: "needs_review" }, { status: 201 });
      }
      return Response.json({ ...sampleEncounterDetailResponse, id: "e1", status: "needs_review" });
    }),
  );
  window.localStorage.setItem("sickday.demoSessionToken", SESSION_A);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const es = MESSAGES.es;
const useSpanish = () => act(() => fireEvent.click(screen.getByRole("radio", { name: "Español" })));
const useEnglish = () => act(() => fireEvent.click(screen.getByRole("radio", { name: "English" })));

function renderStudent() {
  render(
    <>
      <SiteHeader />
      <StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />
    </>,
  );
}

describe("language selector", () => {
  test("names each language in that language and sets the page language", () => {
    render(<LanguageSelector />);

    expect(screen.getByRole("radio", { name: "English" }).getAttribute("lang")).toBe("en");
    expect(screen.getByRole("radio", { name: "Español" }).getAttribute("lang")).toBe("es");
    expect(screen.getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe("true");

    useSpanish();

    expect(document.documentElement.lang).toBe("es");
    expect(screen.getByRole("radio", { name: "Español" }).getAttribute("aria-checked")).toBe("true");
  });

  test("the choice survives a refresh within the session, and a new or reset session does not reuse it", () => {
    const first = render(<LanguageSelector />);
    useSpanish();
    first.unmount();

    render(<LanguageSelector />);
    expect(getLanguage()).toBe("es");

    act(() => setSessionToken(SESSION_B));
    expect(getLanguage()).toBe("en");
    expect(screen.getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe("true");
  });

  test("a choice made before pairing is kept separately and does not leak into an existing session", () => {
    window.localStorage.removeItem("sickday.demoSessionToken");
    act(() => setLanguage("es"));
    expect(getLanguage()).toBe("es");

    act(() => setSessionToken(SESSION_A));
    expect(getLanguage()).toBe("en");
  });
});

describe("required notices", () => {
  test("keep the exact English banner and add the Spanish equivalent beside it", () => {
    render(
      <>
        <LanguageSelector />
        <SyntheticBanner />
        <NoticeEquivalent notice="disclaimer" />
      </>,
    );
    expect(screen.queryByText(es.bannerEquivalent)).toBeNull();

    useSpanish();

    expect(screen.getByText("Synthetic demo patient — fictional profile and access data.").getAttribute("lang")).toBe("en");
    expect(screen.getByText(es.bannerEquivalent).getAttribute("lang")).toBe("es");
    expect(screen.getByText(es.disclaimerEquivalent)).toBeDefined();
  });
});

describe("student journey in Spanish", () => {
  test("every step is in Spanish, with plain-language explanations and mock labels still visible", async () => {
    renderStudent();
    useSpanish();

    expect(screen.getByRole("heading", { name: es.flow.title })).toBeDefined();
    expect(screen.getByText(es.profile.explain)).toBeDefined();
    expect(screen.getByText("Mock coverage — not verified")).toBeDefined();
    expect(screen.getByText(new RegExp(es.describe.ownWords.slice(0, 30)))).toBeDefined();

    fireEvent.change(screen.getByLabelText(es.describe.label), { target: { value: "Me desperté con fiebre de 102" } });
    fireEvent.click(screen.getByRole("button", { name: es.describe.continue }));

    expect(await screen.findByText(es.followUps.checklistLegend)).toBeDefined();
    expect(screen.getByText(es.followUps.redFlags.dehydration.label)).toBeDefined();
    expect(screen.getAllByRole("radio", { name: es.common.notSure })).toHaveLength(6);
  });

  test("switching language mid-intake keeps the text, the answers, and the unknowns, and submits nothing", async () => {
    renderStudent();
    fireEvent.change(screen.getByLabelText("What is going on today?"), { target: { value: sampleExtractRequest.text } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("1. Are any of these happening?");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Dehydration or unable to keep liquids down" })).getByRole("radio", { name: "No" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Stiff neck or new rash" })).getByRole("radio", { name: "Not sure" }));

    useSpanish();

    const checked = (group: string, name: string) =>
      within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name }).getAttribute("aria-checked");
    expect(checked(es.followUps.redFlags.dehydration.label, es.common.no)).toBe("true");
    expect(checked(es.followUps.redFlags.stiff_neck_rash.label, es.common.notSure)).toBe("true");
    expect(checked(es.followUps.redFlags.confusion_fainting.label, es.common.no)).toBe("false");
    expect(screen.getByText("fever, whole body aches")).toBeDefined();
    expect(intakeBodies).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: es.flow.continueToReview }));
    expect(await screen.findByText(es.review.title)).toBeDefined();
    expect(screen.getAllByText(es.common.notAnswered)).toHaveLength(4);
  });

  test("switching language never grants or clears consent", async () => {
    renderStudent();
    fireEvent.click(screen.getByRole("button", { name: "Use prepared demo instead" }));
    const english = screen.getByRole("checkbox", { name: /I agree to share/ });
    expect(english.getAttribute("aria-checked")).toBe("false");

    useSpanish();
    const spanish = screen.getByRole("checkbox", { name: es.consent.label });
    expect(spanish.getAttribute("aria-checked")).toBe("false");
    expect((screen.getByRole("button", { name: es.consent.submit }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(spanish);
    useEnglish();

    expect(screen.getByRole("checkbox", { name: /I agree to share/ }).getAttribute("aria-checked")).toBe("true");
    expect(intakeBodies).toEqual([]);
  });

  test("a declined share and a failed extraction are explained in Spanish, with nothing invented", async () => {
    extractReply = () => Response.json({ error: "extraction_unavailable" }, { status: 503 });
    renderStudent();
    useSpanish();

    fireEvent.change(screen.getByLabelText(es.describe.label), { target: { value: "Me duele la garganta desde anoche" } });
    fireEvent.click(screen.getByRole("button", { name: es.describe.continue }));
    expect(await screen.findByText(es.describe.failedTitle)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: es.describe.enterMyself }));

    const summary = await screen.findByRole("region", { name: es.candidate.nothing });
    expect(within(summary).getAllByText(es.common.notReported)).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: es.flow.continueToReview }));
    fireEvent.click(await screen.findByRole("button", { name: es.consent.decline }));
    expect(await screen.findByText(es.flow.declined)).toBeDefined();
    expect(intakeBodies).toEqual([]);
  });

  test("the student's own words and instruction-language preference are sent unchanged", async () => {
    extractReply = () =>
      Response.json({ outsideScenario: false, transcript: "Me desperté con fiebre de 102", candidateFields: { symptoms: ["fiebre"], maxTempF: 102, onsetPhrase: null, suggestedOnsetIso: null, deadlineToday: null, medsMentioned: [] } });
    renderStudent();
    useSpanish();
    fireEvent.change(screen.getByLabelText(es.describe.label), { target: { value: "Me desperté con fiebre de 102" } });
    fireEvent.click(screen.getByRole("button", { name: es.describe.continue }));
    fireEvent.click(await screen.findByRole("button", { name: es.flow.continueToReview }));
    await screen.findByText(es.review.title);

    // Preference starts from the displayed profile selection; the Spanish interface infers nothing.
    expect(screen.getByRole("checkbox", { name: "English" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("checkbox", { name: "English" }));
    fireEvent.click(screen.getByRole("checkbox", { name: es.consent.label }));
    fireEvent.click(screen.getByRole("button", { name: es.consent.submit }));

    expect(await screen.findByText(es.status.reviewTitle)).toBeDefined();
    expect(intakeBodies[0]).toMatchObject({ preferredInstructionLanguages: ["es"], consent: { shareWithClinic: true } });
    expect(intakeBodies[0].intake).toMatchObject({ symptoms: ["fiebre"], transcript: "Me desperté con fiebre de 102" });
  });

  test("cannot submit with no preferred language, and says why", async () => {
    renderStudent();
    fireEvent.change(screen.getByLabelText("What is going on today?"), { target: { value: sampleExtractRequest.text } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continue to review" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "English" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Español" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to share/ }));

    expect(screen.getByText("Choose at least one language.")).toBeDefined();
    expect((screen.getByRole("button", { name: "Submit to demo clinic" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("clinician and packet", () => {
  test("the clinician sees the student's preference, the packet languages default to it, and the clinician still confirms", async () => {
    render(
      <VisitPanel
        encounter={{ ...sampleEncounterDetailResponse, preferredInstructionLanguages: ["es"] }}
        costCeiling={25}
        preferredLanguages={["es"]}
        preferenceSource="student"
      />,
    );
    vi.mocked(fetch).mockImplementation(async (path) => {
      const { buildOptionRows } = await import("@/lib/options");
      return String(path).endsWith("/options") ? Response.json({ found: true, rows: buildOptionRows() }) : Response.json({ unlocked: false, reason: "locked" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Show antiviral demo options" }));
    fireEvent.click(await screen.findByRole("radio", { name: /Select Fictional Generic Antiviral Demo at Fictional Demo Pharmacy A/ }));

    expect(screen.getByRole("checkbox", { name: /Spanish/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("checkbox", { name: /English/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/student's preference/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Review and confirm" })).toBeDefined();
  });

  test("the packet page is in Spanish and says so when the clinician did not include Spanish instructions", async () => {
    const view = {
      ...samplePacketDetailResponse,
      instructionLanguages: ["en"],
      display: {
        patientName: "Alex Demo", therapyName: "Fictional Generic Antiviral Demo", generic: true, pharmacyName: "Fictional Demo Pharmacy A",
        planName: "Fictional Demo Out-of-State PPO", coverageStatus: "Mock covered", coverageMockLabel: "Mock coverage — not verified", stockStatus: "Mock in stock",
        instructions: [{ language: "en", mockLabel: "Demo text — not clinically validated", title: "Demo packet instructions", steps: ["Review the fictional option."], disclaimer: "Prototype workflow." }],
        resources: [],
      },
    };
    vi.mocked(fetch).mockResolvedValue(Response.json(view));
    render(
      <>
        <LanguageSelector />
        <PacketView packetId="p1" />
      </>,
    );
    useSpanish();

    expect(await screen.findByRole("heading", { name: es.packet.title("Alex Demo") })).toBeDefined();
    expect(screen.getByText(es.packet.missingLanguage)).toBeDefined();
    expect(screen.getByText(es.packet.mockCost)).toBeDefined();
    expect(screen.getByText("Mock coverage — not verified")).toBeDefined();
    // The English instructions are shown as written, marked as English, never machine-translated.
    expect(screen.getByText("Review the fictional option.").closest("section")?.getAttribute("lang")).toBe("en");

    useEnglish();
    await waitFor(() => expect(screen.queryByText(es.packet.missingLanguage)).toBeNull());
  });
});

describe("catalogue", () => {
  test("Spanish has real text for every English string", () => {
    const walk = (en: unknown, esValue: unknown, path: string, missing: string[]) => {
      if (typeof en === "string") {
        if (en !== "" && (typeof esValue !== "string" || esValue.trim() === "")) missing.push(path);
      } else if (typeof en === "function") {
        if (typeof esValue !== "function") missing.push(path);
      } else if (en && typeof en === "object") {
        for (const key of Object.keys(en)) walk((en as Record<string, unknown>)[key], (esValue as Record<string, unknown> | undefined)?.[key], `${path}.${key}`, missing);
      }
      return missing;
    };

    expect(walk(MESSAGES.en, MESSAGES.es, "messages", [])).toEqual([]);
  });

  test("Spanish never claims validation, booking, or verified coverage", () => {
    const text = JSON.stringify(MESSAGES.es, (_key, value) => (typeof value === "function" ? value("X", "Y") : value));

    expect(text).not.toMatch(/cobertura verificada|cita confirmada|receta enviada|traducción (automática|en vivo)/i);
    expect(text).toContain("sin validación clínica");
    expect(text).toContain("no traduce");
  });
});
