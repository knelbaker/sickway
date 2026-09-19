import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { VisitPanel } from "@/components/hcp/visit-panel";
import { sampleAttachResponse, sampleEncounterDetailResponse } from "@/lib/api-contracts";
import { buildOptionRows } from "@/lib/options";

const GENERIC_AT_A = "Select Fictional Generic Antiviral Demo at Fictional Demo Pharmacy A";

/** A controllable stand-in for window.matchMedia("(min-width: 768px)"). */
let wide: boolean;
let listeners: Set<() => void>;
function setWide(next: boolean) {
  wide = next;
  act(() => listeners.forEach((listener) => listener()));
}

let attachBodies: unknown[];

beforeEach(() => {
  wide = false;
  listeners = new Set();
  attachBodies = [];
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return wide;
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path.endsWith("/options")) return Response.json({ found: true, rows: buildOptionRows() });
      if (path.endsWith("/resources")) return Response.json({ unlocked: false, reason: "locked" });
      attachBodies.push(JSON.parse(String(init?.body)));
      return Response.json(sampleAttachResponse);
    }),
  );
  window.localStorage.setItem("sickday.demoSessionToken", `${"a".repeat(32)}.signature`);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

async function showOptions() {
  render(<VisitPanel encounter={sampleEncounterDetailResponse} costCeiling={25} preferredLanguages={["en", "es"]} />);
  fireEvent.click(screen.getByRole("button", { name: "Show antiviral demo options" }));
  await screen.findAllByText("Mock cost");
}

test("on a phone the options are cards, not a table, and every value keeps its mock label beside it", async () => {
  await showOptions();

  expect(screen.queryByRole("table")).toBeNull();
  const cards = within(screen.getByRole("list", { name: "Demo options" })).getAllByRole("listitem");
  expect(cards).toHaveLength(4);
  expect(cards.map((card) => within(card).getByText(/Antiviral Demo$/).textContent)).toEqual([
    "Fictional Generic Antiviral Demo",
    "Fictional Generic Antiviral Demo",
    "Fictional Brand Antiviral Demo",
    "Fictional Brand Antiviral Demo",
  ]);
  for (const card of cards) {
    expect(within(card).getByText("Mock cost")).toBeDefined();
    expect(within(card).getByText("Mock coverage — not verified")).toBeDefined();
    expect(within(card).getByText("Mock stock")).toBeDefined();
  }
  expect(within(cards[2]).getByText("Above $25 fictional ceiling")).toBeDefined();
  expect(screen.getByText(/The clinician chooses; this list does not recommend/)).toBeDefined();
});

test("there is only one set of controls, so keyboard and screen-reader users never meet duplicates", async () => {
  await showOptions();

  expect(screen.getAllByRole("radio", { name: GENERIC_AT_A })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: /Show manufacturer resources for/ })).toHaveLength(2);
});

test("a whole-width label selects the option on a phone, and the normal confirm flow follows", async () => {
  await showOptions();

  fireEvent.click(screen.getAllByText("Select this option")[0]);
  expect((screen.getByRole("radio", { name: GENERIC_AT_A }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm and attach" }));

  expect(await screen.findByText("Packet available in demo")).toBeDefined();
  expect(attachBodies[0]).toMatchObject({ confirmed: true, therapyId: "therapy-generic-demo", pharmacyId: "pharmacy-demo-a", mockPrice: 12 });
});

test("rotating or resizing between the card and table layouts keeps the selection and the chosen languages", async () => {
  await showOptions();
  fireEvent.click(screen.getByRole("radio", { name: GENERIC_AT_A }));
  fireEvent.click(screen.getByRole("checkbox", { name: /English/ }));

  setWide(true);

  expect(screen.getByRole("table")).toBeDefined();
  expect(screen.queryByRole("list", { name: "Demo options" })).toBeNull();
  expect((screen.getByRole("radio", { name: GENERIC_AT_A }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole("checkbox", { name: /English/ }).getAttribute("aria-checked")).toBe("false");

  setWide(false);

  expect((screen.getByRole("radio", { name: GENERIC_AT_A }) as HTMLInputElement).checked).toBe(true);
});
