import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { VisitPanel } from "@/components/hcp/visit-panel";
import { attachRequestSchema, sampleAttachResponse, sampleEncounterDetailResponse } from "@/lib/api-contracts";
import { buildOptionRows } from "@/lib/options";
import type { Encounter } from "@/lib/schemas";

const BRAND = "therapy-brand-demo";
const GENERIC_NAME = "Fictional Generic Antiviral Demo";
const BRAND_NAME = "Fictional Brand Antiviral Demo";
const copay = {
  id: "resource-demo-copay",
  therapyId: BRAND,
  type: "copay_card",
  title: "Fictional Demo Copay Card",
  description: "Static sample only.",
  mockLabel: "Manufacturer resource — fictional demo",
};

let attach: () => Response | Promise<Response>;
let attachBodies: unknown[];

beforeEach(() => {
  attachBodies = [];
  attach = () => Response.json(sampleAttachResponse);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (path.endsWith("/options")) return Response.json({ found: true, rows: buildOptionRows() });
      if (path.endsWith("/resources")) {
        return body.therapyId === BRAND
          ? Response.json({ unlocked: true, therapyId: BRAND, resources: [copay] })
          : Response.json({ unlocked: false, reason: "locked" });
      }
      attachBodies.push(body);
      return attach();
    }),
  );
  window.localStorage.setItem("sickday.demoSessionToken", `${"a".repeat(32)}.signature`);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function renderPanel(changes: Partial<Encounter> = {}) {
  render(
    <VisitPanel
      encounter={{ ...sampleEncounterDetailResponse, ...changes }}
      costCeiling={25}
      preferredLanguages={["en", "es"]}
    />,
  );
}

async function showOptions() {
  fireEvent.click(screen.getByRole("button", { name: "Show antiviral demo options" }));
  await screen.findByRole("table");
}

const select = (therapy: string, pharmacy: string) =>
  fireEvent.click(screen.getByRole("radio", { name: `Select ${therapy} at ${pharmacy}` }));

test("nothing is pre-selected and there is no attach control until the clinician picks a row", async () => {
  renderPanel();
  await showOptions();

  expect(screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
  expect(screen.queryByRole("button", { name: "Review and confirm" })).toBeNull();
});

test("attaches the generic with Spanish instructions only after review and confirmation", async () => {
  renderPanel();
  await showOptions();
  select(GENERIC_NAME, "Fictional Demo Pharmacy A");

  // Defaults come from the profile's displayed preferences; the clinician narrows to Spanish.
  expect(screen.getByRole("checkbox", { name: /English/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("checkbox", { name: /Spanish/ }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("checkbox", { name: /English/ }));
  fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));

  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(GENERIC_NAME)).toBeDefined();
  expect(within(dialog).getByText("Fictional Demo Pharmacy A")).toBeDefined();
  expect(within(dialog).getByText("Mock cost")).toBeDefined();
  expect(within(dialog).getByText("Mock coverage — not verified")).toBeDefined();
  expect(dialog.textContent).toContain("Spanish — prewritten demo text");
  expect(dialog.textContent).toContain("Nothing is transmitted to a pharmacy, clinic, insurer, or manufacturer");
  expect(attachBodies).toEqual([]);

  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and attach" }));

  expect(await screen.findByText("Packet available in demo")).toBeDefined();
  expect(attachRequestSchema.parse(attachBodies[0])).toEqual({
    confirmed: true,
    therapyId: "therapy-generic-demo",
    pharmacyId: "pharmacy-demo-a",
    mockPrice: 12,
    instructionLanguages: ["es"],
    resourceIds: [],
  });
  expect(screen.queryByRole("button", { name: "Review and confirm" })).toBeNull();
});

test("cancelling the dialog sends no attach request", async () => {
  renderPanel();
  await showOptions();
  select(GENERIC_NAME, "Fictional Demo Pharmacy A");
  fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));

  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(attachBodies).toEqual([]);
  expect((screen.getByRole("radio", { name: `Select ${GENERIC_NAME} at Fictional Demo Pharmacy A` }) as HTMLInputElement).checked).toBe(true);
});

test("a double click on Confirm sends one attach request", async () => {
  let release: (response: Response) => void = () => {};
  attach = () => new Promise<Response>((resolve) => (release = resolve));
  renderPanel();
  await showOptions();
  select(GENERIC_NAME, "Fictional Demo Pharmacy A");
  fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));
  const confirm = within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm and attach" });

  fireEvent.click(confirm);
  fireEvent.click(confirm);
  release(Response.json(sampleAttachResponse));

  expect(await screen.findByText("Packet available in demo")).toBeDefined();
  expect(attachBodies).toHaveLength(1);
});

test("keeps the selection and explains the failure when attach is refused", async () => {
  attach = () => Response.json({ error: "resource_locked" }, { status: 403 });
  renderPanel();
  await showOptions();
  select(GENERIC_NAME, "Fictional Demo Pharmacy B");
  fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm and attach" }));

  expect(await screen.findByText(/is not unlocked for this encounter. Nothing was attached/)).toBeDefined();
  expect((screen.getByRole("radio", { name: `Select ${GENERIC_NAME} at Fictional Demo Pharmacy B` }) as HTMLInputElement).checked).toBe(true);
  expect(screen.queryByText("Packet available in demo")).toBeNull();
});

test("offers only unlocked resources of the chosen therapy, and never a locked therapy's", async () => {
  renderPanel();
  await showOptions();

  // Brand selected but not unlocked: no resource choices at all.
  select(BRAND_NAME, "Fictional Demo Pharmacy A");
  expect(screen.queryByText("Include unlocked manufacturer resources (optional)")).toBeNull();

  fireEvent.click(screen.getAllByRole("button", { name: `Show manufacturer resources for ${BRAND_NAME}` })[0]);
  const include = await screen.findByRole("checkbox", { name: "Fictional Demo Copay Card" });
  expect(include.getAttribute("aria-checked")).toBe("false");

  // Switching to the generic removes the brand's resources from the offer.
  select(GENERIC_NAME, "Fictional Demo Pharmacy A");
  expect(screen.queryByRole("checkbox", { name: "Fictional Demo Copay Card" })).toBeNull();
});

test("sends an included resource only after the clinician ticks it", async () => {
  renderPanel();
  await showOptions();
  fireEvent.click(screen.getAllByRole("button", { name: `Show manufacturer resources for ${BRAND_NAME}` })[0]);
  select(BRAND_NAME, "Fictional Demo Pharmacy A");
  fireEvent.click(await screen.findByRole("checkbox", { name: "Fictional Demo Copay Card" }));
  fireEvent.click(screen.getByRole("button", { name: "Review and confirm" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Manufacturer resource — fictional demo")).toBeDefined();
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and attach" }));

  await screen.findByText("Packet available in demo");
  expect(attachBodies[0]).toMatchObject({ therapyId: BRAND, mockPrice: 45, resourceIds: ["resource-demo-copay"] });
});

test("offers no selection for a needs-review encounter", async () => {
  renderPanel({ status: "needs_review" });
  await showOptions();

  expect(screen.queryAllByRole("radio")).toEqual([]);
});

test("shows the packet status and no attach controls for an encounter that already has a packet", async () => {
  renderPanel({ status: "packet_available", packetId: "enc-demo-001" });

  expect(screen.getByText("Packet available in demo")).toBeDefined();
  await showOptions();
  expect(screen.queryAllByRole("radio")).toEqual([]);
});
