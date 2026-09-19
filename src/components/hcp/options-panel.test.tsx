import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { OptionsPanel } from "@/components/hcp/options-panel";
import { buildOptionRows } from "@/lib/options";

const BRAND = "therapy-brand-demo";
const BRAND_NAME = "Fictional Brand Antiviral Demo";
const rows = buildOptionRows();

const brandResources = [
  {
    id: "resource-demo-copay",
    therapyId: BRAND,
    type: "copay_card",
    title: "Fictional Demo Copay Card",
    description: "Static sample only.",
    mockLabel: "Manufacturer resource — fictional demo",
  },
];

type Reply = { status?: number; body: unknown };
let options: (query: string) => Reply;
let resources: (body: { therapyId?: string; text?: string }) => Reply;
let calls: { path: string; body: Record<string, string> }[];

beforeEach(() => {
  calls = [];
  options = () => ({ body: { found: true, rows } });
  resources = () => ({ body: { unlocked: false, reason: "No specific demo therapy was named. A category request does not unlock manufacturer resources." } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      calls.push({ path, body });
      const reply = path.endsWith("/options") ? options(body.query) : resources(body);
      return Response.json(reply.body, { status: reply.status ?? 200 });
    }),
  );
  window.localStorage.setItem("sickday.demoSessionToken", `${"a".repeat(32)}.signature`);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function renderPanel(unlockedTherapyIds: string[] = []) {
  render(<OptionsPanel encounterId="enc-1" costCeiling={25} unlockedTherapyIds={unlockedTherapyIds} />);
}

function type(text: string) {
  fireEvent.change(screen.getByLabelText("Ask about demo options"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

const drawer = () => screen.getByRole("region", { name: "Manufacturer resources" });

test("a typed category question shows the generic-first table and leaves the drawer locked", async () => {
  renderPanel();
  expect(drawer().textContent).toContain("Locked.");

  type("Show the antiviral demo options and sample costs");

  const table = await screen.findByRole("table");
  const therapyCells = within(table).getAllByRole("rowheader").map((cell) => cell.textContent);
  expect(therapyCells).toEqual([
    "Fictional Generic Antiviral DemoGeneric",
    "Fictional Generic Antiviral DemoGeneric",
    `${BRAND_NAME}Brand`,
    `${BRAND_NAME}Brand`,
  ]);
  expect(drawer().textContent).toContain("Locked.");
  expect(drawer().textContent).not.toContain("Copay");
  // A plain options question is expected to stay locked, so no "still locked" notice is shown.
  expect(within(drawer()).queryByRole("status")).toBeNull();
});

test("labels every cost, coverage, and stock value as mock in its own cell, and marks rows above the ceiling", async () => {
  renderPanel();
  fireEvent.click(screen.getByRole("button", { name: "Show antiviral demo options" }));
  const table = await screen.findByRole("table");

  for (const row of within(table).getAllByRole("row").slice(1)) {
    const cells = within(row).getAllByRole("cell");
    expect(cells[1].textContent).toContain("Mock cost");
    expect(cells[2].textContent).toContain("Mock coverage — not verified");
    expect(cells[3].textContent).toContain("Mock stock");
  }
  expect(within(table).getAllByText("Above $25 fictional ceiling")).toHaveLength(2);
  expect(within(table).getAllByText("None in demo")).toHaveLength(2);
});

test("the row button unlocks only that therapy, through the server, with the fictional label", async () => {
  resources = (body) =>
    body.therapyId === BRAND
      ? { body: { unlocked: true, therapyId: BRAND, resources: brandResources, auditEventId: "evt-1" } }
      : { body: { unlocked: false, reason: "locked" } };
  renderPanel();
  fireEvent.click(screen.getByRole("button", { name: "Show antiviral demo options" }));
  await screen.findByRole("table");

  fireEvent.click(screen.getAllByRole("button", { name: `Show manufacturer resources for ${BRAND_NAME}` })[0]);

  expect(await within(drawer()).findByText(`Unlocked for ${BRAND_NAME} only`)).toBeDefined();
  expect(within(drawer()).getByText("Fictional Demo Copay Card")).toBeDefined();
  expect(within(drawer()).getByText("Manufacturer resource — fictional demo")).toBeDefined();
  expect(calls.at(-1)).toEqual({ path: "/api/encounters/enc-1/resources", body: { therapyId: BRAND } });
});

test("a typed request naming the therapy unlocks through the same resources route, with no client-side decision", async () => {
  resources = (body) =>
    body.text?.includes(BRAND_NAME)
      ? { body: { unlocked: true, therapyId: BRAND, resources: brandResources, auditEventId: "evt-2" } }
      : { body: { unlocked: false, reason: "locked" } };
  renderPanel();

  type(`Show manufacturer resources for ${BRAND_NAME}`);

  expect(await within(drawer()).findByText("Fictional Demo Copay Card")).toBeDefined();
  expect(calls.map((call) => call.path)).toEqual(["/api/encounters/enc-1/options", "/api/encounters/enc-1/resources"]);
  expect(calls[1].body).toEqual({ text: `Show manufacturer resources for ${BRAND_NAME}` });
});

test("shows the server's reason when resources were asked for but stay locked", async () => {
  renderPanel();

  type("show me the manufacturer resources for antivirals");

  expect((await within(drawer()).findByRole("status")).textContent).toContain("A category request does not unlock");
  expect(drawer().textContent).not.toContain("Copay");
});

test("shows No demo option found and no table for an unsupported question", async () => {
  options = () => ({ body: { found: false, message: "No demo option found" } });
  renderPanel();

  type("Show antibiotic options");

  expect(await screen.findByText("No demo option found")).toBeDefined();
  expect(screen.queryByRole("table")).toBeNull();
});

test("shows an error and changes nothing when the options route fails", async () => {
  options = () => ({ status: 503, body: { error: "unavailable" } });
  renderPanel();

  type("antiviral options");

  expect(await screen.findByText("Could not load options")).toBeDefined();
  expect(screen.queryByRole("table")).toBeNull();
  expect(calls.filter((call) => call.path.endsWith("/resources"))).toEqual([]);
});

test("offers Show again for a therapy the encounter already has unlocked", async () => {
  renderPanel([BRAND]);
  fireEvent.click(screen.getByRole("button", { name: "Show antiviral demo options" }));
  const table = await screen.findByRole("table");

  await waitFor(() => expect(within(table).getAllByText("Show again")).toHaveLength(2));
  expect(drawer().textContent).toContain("Locked.");
});
