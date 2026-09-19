import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ClinicianWorkspace } from "@/components/hcp/clinician-workspace";
import { sampleEncounterDetailResponse, sampleEncountersQueueResponse } from "@/lib/api-contracts";
import type { Encounter } from "@/lib/schemas";

const profile = {
  name: "Alex Demo",
  age: 20,
  planName: "Fictional Demo Out-of-State PPO",
  planMockLabel: "Mock coverage — not verified",
  instructionLanguages: ["en", "es"],
  costCeiling: 25,
  fixtureClock: "2026-09-19T10:00:00-04:00",
};

let queue: unknown[];
let encounters: Record<string, Encounter>;

function encounter(changes: Partial<Encounter> = {}): Encounter {
  return { ...sampleEncounterDetailResponse, ...changes };
}

beforeEach(() => {
  vi.useFakeTimers();
  queue = [];
  encounters = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === "/api/encounters") return Response.json(queue);
      const found = encounters[path.replace("/api/encounters/", "")];
      return found ? Response.json(found) : Response.json({ error: "encounter_not_found" }, { status: 404 });
    }),
  );
  window.localStorage.setItem("sickday.demoSessionToken", `${"a".repeat(32)}.signature`);
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const tick = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

async function open(id: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(sampleEncountersQueueResponse[0].displayName) }));
  void id;
  await tick();
}

test("explains the empty queue, then shows a new submission on the next poll without a refresh", async () => {
  render(<ClinicianWorkspace profile={profile} />);
  await tick();
  expect(screen.getByText(/appears here only after the student reviews it and gives consent/)).toBeDefined();

  queue = sampleEncountersQueueResponse;
  await tick(2000);

  expect(screen.getByRole("button", { name: /Alex Demo/ })).toBeDefined();
  expect(screen.getByText("fever, body aches")).toBeDefined();
  expect(screen.getByText("1 shared")).toBeDefined();
});

test("shows the four SBAR sections as text with a source badge that matches the stored brief", async () => {
  queue = sampleEncountersQueueResponse;
  encounters["enc-demo-001"] = encounter();
  render(<ClinicianWorkspace profile={profile} />);
  await tick();
  await open("enc-demo-001");

  const brief = screen.getByRole("region", { name: "Clinician brief (SBAR)" });
  for (const heading of ["Situation", "Background", "Assessment", "Recommendation"]) {
    expect(within(brief).getByText(heading)).toBeDefined();
  }
  expect(within(brief).getByText(sampleEncounterDetailResponse.sbar!.situation)).toBeDefined();
  expect(within(brief).getByText("Prepared fixture output")).toBeDefined();
});

test.each([
  ["generated", "Generated from the reviewed intake"],
  ["deterministic", "Deterministic summary — assembled without the model"],
] as const)("labels a %s brief", async (source, label) => {
  queue = sampleEncountersQueueResponse;
  encounters["enc-demo-001"] = encounter({ sbar: { ...sampleEncounterDetailResponse.sbar!, source } });
  render(<ClinicianWorkspace profile={profile} />);
  await tick();
  await open("enc-demo-001");

  expect(screen.getByText(label)).toBeDefined();
});

test("shows unanswered values as not reported, explicit none as none reported, each with its source", async () => {
  queue = sampleEncountersQueueResponse;
  encounters["enc-demo-001"] = encounter({
    intake: {
      ...sampleEncounterDetailResponse.intake,
      medsTaken: null,
      allergies: [],
      redFlags: { ...sampleEncounterDetailResponse.intake.redFlags, dehydration: null },
    },
  });
  render(<ClinicianWorkspace profile={profile} />);
  await tick();
  await open("enc-demo-001");

  const sources = screen.getByRole("region", { name: "Source values" });
  const row = (label: string) => within(sources).getByText(label).parentElement as HTMLElement;
  expect(row("Medications taken").textContent).toContain("not reported");
  expect(row("Allergies").textContent).toContain("none reported");
  expect(row("Dehydration or unable to keep liquids down").textContent).toContain("not reported");
  expect(row("Dehydration or unable to keep liquids down").textContent).not.toMatch(/\bNo\b/);
  expect(row("Symptoms").textContent).toContain("student review");
  expect(row("Patient").textContent).toContain("synthetic profile");
  expect(row("Plan").textContent).toContain("Mock coverage — not verified");
  expect(row("Onset").textContent).toContain("confirmed by the student");
  expect(sources.textContent).not.toMatch(/no known|no red flags/i);
});

test("an emergency encounter is visibly distinct and offers no brief", async () => {
  queue = [{ ...sampleEncountersQueueResponse[0], status: "emergency" }];
  encounters["enc-demo-001"] = encounter({
    status: "emergency",
    sbar: undefined,
    intake: {
      ...sampleEncounterDetailResponse.intake,
      redFlags: { ...sampleEncounterDetailResponse.intake.redFlags, breathing_chest_pain: true },
    },
  });
  render(<ClinicianWorkspace profile={profile} />);
  await tick();
  await open("enc-demo-001");

  expect(screen.getByText("Emergency branch — routine demo flow bypassed")).toBeDefined();
  expect(screen.getByRole("alert").textContent).toContain("Breathing difficulty or chest pain");
  expect(screen.queryByRole("region", { name: "Clinician brief (SBAR)" })).toBeNull();
});

test("a needs-review encounter names the unanswered items and never reads as an all-clear", async () => {
  queue = [{ ...sampleEncountersQueueResponse[0], status: "needs_review" }];
  encounters["enc-demo-001"] = encounter({
    status: "needs_review",
    intake: {
      ...sampleEncounterDetailResponse.intake,
      redFlags: { ...sampleEncounterDetailResponse.intake.redFlags, stiff_neck_rash: null },
    },
  });
  render(<ClinicianWorkspace profile={profile} />);
  await tick();
  await open("enc-demo-001");

  const notice = screen.getByRole("alert");
  expect(notice.textContent).toContain("Needs review — not an all-clear");
  expect(notice.textContent).toContain("Stiff neck or new rash");
});

test("updates the open encounter's status on the next poll", async () => {
  queue = sampleEncountersQueueResponse;
  encounters["enc-demo-001"] = encounter();
  render(<ClinicianWorkspace profile={profile} />);
  await tick();
  await open("enc-demo-001");
  expect(screen.queryByText("Packet available in demo")).toBeNull();

  encounters["enc-demo-001"] = encounter({ status: "packet_available", packetId: "enc-demo-001" });
  await tick(2000);

  expect(screen.getAllByText("Packet available in demo").length).toBeGreaterThan(0);
});

test("closes an open encounter that is no longer in this session's queue", async () => {
  queue = sampleEncountersQueueResponse;
  encounters["enc-demo-001"] = encounter();
  render(<ClinicianWorkspace profile={profile} />);
  await tick();
  await open("enc-demo-001");
  expect(screen.getByRole("region", { name: "Source values" })).toBeDefined();

  queue = [];
  await tick(2000);

  expect(screen.queryByRole("region", { name: "Source values" })).toBeNull();
});
