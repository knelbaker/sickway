import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PollStatus } from "@/components/poll-status";
import { StudentFlow } from "@/components/student/student-flow";
import { sampleEncounterDetailResponse } from "@/lib/api-contracts";
import { fixtures } from "@/lib/fixtures";

const SESSION = "a".repeat(32);
const profile = {
  name: "Alex Demo",
  age: 20,
  planName: "Fictional Demo Out-of-State PPO",
  planMockLabel: "Mock coverage — not verified",
  instructionLanguages: ["en", "es"],
  costCeiling: 25,
  fixtureClock: fixtures.profile.fixtureClock,
};

beforeEach(() => {
  window.localStorage.setItem("sickday.demoSessionToken", `${SESSION}.signature`);
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

test("the prepared demo is an explicit choice, shown as fixture output, with consent still separate", async () => {
  const bodies: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === "/api/intake") {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ encounterId: "enc-1", status: "ready" }, { status: 201 });
      }
      return Response.json({ ...sampleEncounterDetailResponse, id: "enc-1" });
    }),
  );
  render(<StudentFlow profile={profile} preparedIntake={fixtures.profile.intake} />);

  fireEvent.click(screen.getByRole("button", { name: "Use prepared demo instead" }));

  const summary = screen.getByRole("region", { name: /Prepared demo case/ });
  expect(within(summary).getByText("Prepared fixture output")).toBeDefined();
  expect(summary.textContent).toContain("scripted answers from the demo fixture, not yours");
  expect(within(summary).getAllByText("demo fixture").length).toBeGreaterThan(10);

  const consent = screen.getByRole("checkbox", { name: /I agree to share/ });
  const submit = screen.getByRole("button", { name: "Submit to demo clinic" }) as HTMLButtonElement;
  expect(consent.getAttribute("aria-checked")).toBe("false");
  expect(submit.disabled).toBe(true);

  fireEvent.click(consent);
  fireEvent.click(submit);

  expect(await screen.findByText("Prepared fixture output")).toBeDefined();
  // The client sends only the flag and consent; the server supplies the fixture.
  expect(bodies).toEqual([{ usePreparedDemo: true, consent: { shareWithClinic: true } }]);
});

test("typing something and failing extraction never switches to the prepared case", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "extraction_unavailable" }, { status: 503 })));
  render(<StudentFlow profile={profile} preparedIntake={fixtures.profile.intake} />);

  fireEvent.change(screen.getByLabelText("What is going on today?"), { target: { value: "I have a sore throat" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(await screen.findByRole("button", { name: "Enter details myself" }));

  expect(await screen.findByText("Nothing was filled in automatically")).toBeDefined();
  expect(screen.queryByText(/Prepared demo case/)).toBeNull();
  expect(screen.queryByText("102°F")).toBeNull();
});

test("the student screen labels the clinic brief's source", async () => {
  vi.useFakeTimers();
  window.sessionStorage.setItem(`sickday.submitted.${SESSION}`, JSON.stringify({ encounterId: "enc-1", status: "ready" }));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({ ...sampleEncounterDetailResponse, id: "enc-1", sbar: { ...sampleEncounterDetailResponse.sbar!, source: "deterministic" } }),
    ),
  );
  render(<StudentFlow profile={profile} preparedIntake={fixtures.profile.intake} />);
  await act(() => vi.advanceTimersByTimeAsync(0));

  expect(screen.getByText("Deterministic summary — assembled without the model")).toBeDefined();
});

test("PollStatus shows live, then a stale warning with the last good time, and recovers", () => {
  vi.useFakeTimers({ now: new Date("2026-09-19T14:00:00") });
  const updatedAt = Date.now();
  const view = render(<PollStatus poll={{ error: null, updatedAt }} />);
  expect(screen.getByRole("status").textContent).toMatch(/^Live · updated/);

  view.rerender(<PollStatus poll={{ error: "unavailable", updatedAt }} />);
  expect(screen.getByRole("status").textContent).toMatch(/^Reconnecting… showing data from/);

  // No error reported, but no fresh data for ten seconds: still flagged as stale.
  view.rerender(<PollStatus poll={{ error: null, updatedAt }} />);
  act(() => void vi.advanceTimersByTime(10_000));
  expect(screen.getByRole("status").textContent).toMatch(/^Reconnecting… showing data from/);

  view.rerender(<PollStatus poll={{ error: null, updatedAt: Date.now() }} />);
  expect(screen.getByRole("status").textContent).toMatch(/^Live · updated/);
});

test("PollStatus stays silent for an ended session, which has its own message", () => {
  render(<PollStatus poll={{ error: "session", updatedAt: null }} />);

  expect(screen.queryByRole("status")).toBeNull();
});
