import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StudentFlow } from "@/components/student/student-flow";
import { draftReducer, emptyDraft, toReviewedIntake } from "@/components/student/use-intake-draft";
import { intakeRequestSchema, sampleExtractRequest, sampleExtractResponse } from "@/lib/api-contracts";
import { sampleIntakeRequest } from "@/lib/api-contracts";

const TOKEN = `${"a".repeat(32)}.signature`;
const profile = {
  name: "Alex Demo",
  age: 20,
  planName: "Fictional Demo Out-of-State PPO",
  planMockLabel: "Mock coverage — not verified",
  instructionLanguages: ["en", "es"],
  costCeiling: 25,
  fixtureClock: "2026-09-19T10:00:00-04:00",
};

/** Routes fetch by path so each test states only what the intake call returns. */
function stubApi(intake: () => Response) {
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    void init;
    return path === "/api/extract" ? Response.json(sampleExtractResponse) : intake();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The `RequestInit` of each `POST /api/intake` the screen made. */
function intakeCalls(fetchMock: ReturnType<typeof stubApi>): RequestInit[] {
  return fetchMock.mock.calls.filter(([path]) => path === "/api/intake").map(([, init]) => init ?? {});
}

async function reachReview({ answerAllNo = true } = {}) {
  fireEvent.change(screen.getByLabelText("What is going on today?"), { target: { value: sampleExtractRequest.text } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("1. Are any of these happening?");
  if (answerAllNo) {
    for (const group of screen.getAllByRole("radiogroup").slice(0, 6)) {
      fireEvent.click(within(group).getByRole("radio", { name: "No" }));
    }
  }
  fireEvent.click(screen.getByRole("button", { name: "Continue to review" }));
  await screen.findByText("Review before sharing");
}

beforeEach(() => {
  window.localStorage.setItem("sickday.demoSessionToken", TOKEN);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("onset confirmation", () => {
  test("editing the time withdraws a confirmation, and no time means nothing to confirm", () => {
    let draft = draftReducer(emptyDraft(), { type: "onset", onsetIso: "2026-09-18T08:00:00-04:00" });
    draft = draftReducer(draft, { type: "confirmOnset", confirmed: true });
    expect(toReviewedIntake(draft)).toMatchObject({ onsetIso: "2026-09-18T08:00:00-04:00", onsetConfirmed: true });

    draft = draftReducer(draft, { type: "onset", onsetIso: "2026-09-18T21:00:00-04:00" });
    expect(toReviewedIntake(draft).onsetConfirmed).toBe(false);

    draft = draftReducer(draft, { type: "onset", onsetIso: null });
    draft = draftReducer(draft, { type: "confirmOnset", confirmed: true });
    expect(toReviewedIntake(draft)).toMatchObject({ onsetIso: null, onsetConfirmed: false });
  });
});

describe("review, consent, and submit", () => {
  test("keeps Submit disabled until the separate consent box is ticked, and starts unticked", async () => {
    stubApi(() => Response.json({ encounterId: "e1", status: "ready" }, { status: 201 }));
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    await reachReview();

    const consent = screen.getByRole("checkbox", { name: /I agree to share this synthetic intake/ });
    const submit = screen.getByRole("button", { name: "Submit to demo clinic" }) as HTMLButtonElement;
    expect(consent.getAttribute("aria-checked")).toBe("false");
    expect(submit.disabled).toBe(true);

    fireEvent.click(consent);
    expect(submit.disabled).toBe(false);
  });

  test("declining keeps the intake on this screen and makes no intake request", async () => {
    const fetchMock = stubApi(() => Response.json({}, { status: 500 }));
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    await reachReview();

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    expect(await screen.findByText(/The demo clinic cannot see it and nothing was sent/)).toBeDefined();
    expect(intakeCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByText("Review before sharing")).toBeDefined();
  });

  test("submits the edited, reviewed values with literal consent and an unconfirmed onset by default", async () => {
    const fetchMock = stubApi(() => Response.json({ encounterId: "e1", status: "ready" }, { status: 201 }));
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    await reachReview();

    fireEvent.change(screen.getByLabelText("Highest temperature (°F)"), { target: { value: "100.4" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to share/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit to demo clinic" }));
    await screen.findByText("Shared with the demo clinic");

    const [init] = intakeCalls(fetchMock);
    const body = intakeRequestSchema.parse(JSON.parse(init.body as string));
    expect(new Headers(init.headers).get("x-demo-session")).toBe(TOKEN);
    expect(body.consent).toEqual({ shareWithClinic: true });
    expect(body.intake).toMatchObject({
      maxTempF: 100.4,
      symptoms: ["fever", "whole body aches"],
      onsetIso: "2026-09-18T08:00:00.000Z",
      onsetConfirmed: false,
      medsTaken: null,
      allergies: null,
      transcript: sampleExtractRequest.text,
    });
    expect(Object.values(body.intake.redFlags)).toEqual([false, false, false, false, false, false]);
  });

  test("sends a confirmed onset only after the student ticks the confirmation", async () => {
    const fetchMock = stubApi(() => Response.json({ encounterId: "e1", status: "ready" }, { status: 201 }));
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    await reachReview();

    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm it started around/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to share/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit to demo clinic" }));
    await screen.findByText("Shared with the demo clinic");

    const [init] = intakeCalls(fetchMock);
    expect(JSON.parse(init.body as string).intake.onsetConfirmed).toBe(true);
  });

  test("sends skipped checklist items as null and shows them as not answered in review", async () => {
    const fetchMock = stubApi(() => Response.json({ encounterId: "e1", status: "needs_review" }, { status: 201 }));
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    await reachReview({ answerAllNo: false });

    expect(screen.getAllByText("Not answered")).toHaveLength(6);
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to share/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit to demo clinic" }));
    await screen.findByText("Shared — needs review");

    const [init] = intakeCalls(fetchMock);
    expect(Object.values(JSON.parse(init.body as string).intake.redFlags)).toEqual(Array(6).fill(null));
  });

  test("keeps the review on screen with a clear message when the server refuses", async () => {
    stubApi(() => Response.json({ error: "consent_required" }, { status: 400 }));
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    await reachReview();

    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to share/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit to demo clinic" }));

    expect(await screen.findByText(/Consent is required before anything is shared/)).toBeDefined();
    expect(screen.getByText("Review before sharing")).toBeDefined();
    expect(window.sessionStorage.length).toBe(0);
  });
});

describe("status after sharing", () => {
  async function submitWithStatus(status: string) {
    stubApi(() => Response.json({ encounterId: "e1", status }, { status: 201 }));
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    await reachReview();
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to share/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit to demo clinic" }));
    await waitFor(() => expect(screen.queryByText("Review before sharing")).toBeNull());
  }

  test("ready shows the honest next step beside the mock coverage label", async () => {
    await submitWithStatus("ready");

    const status = screen.getByRole("alert");
    expect(within(status).getByText("Demo next step: campus clinic")).toBeDefined();
    expect(within(status).getByText("Booking not connected.")).toBeDefined();
    expect(within(status).getByText("Mock coverage — not verified")).toBeDefined();
    expect(status.textContent).not.toMatch(/appointment|booked|confirmed|reserved|scheduled|held/i);
  });

  test("needs_review never reads as an all-clear", async () => {
    await submitWithStatus("needs_review");

    const status = screen.getByRole("alert");
    expect(within(status).getByText("Shared — needs review")).toBeDefined();
    expect(status.textContent).toContain("This is not an all-clear");
    expect(status.textContent).not.toMatch(/no red flags|campus clinic/i);
  });

  test("emergency shows emergency messaging and no clinic next step", async () => {
    await submitWithStatus("emergency");

    const status = screen.getByRole("alert");
    expect(status.textContent).toContain("call 911");
    expect(status.textContent).toContain("not a validated medical screening result");
    expect(status.textContent).not.toMatch(/campus clinic|Booking not connected/);
  });

  test("restores the status after a refresh in the same session, but not in a new session", async () => {
    await submitWithStatus("ready");
    cleanup();

    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    expect(screen.getByText("Shared with the demo clinic")).toBeDefined();
    cleanup();

    window.localStorage.setItem("sickday.demoSessionToken", `${"b".repeat(32)}.signature`);
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    expect(screen.queryByText("Shared with the demo clinic")).toBeNull();
    expect(screen.getByLabelText("What is going on today?")).toBeDefined();
  });
});
