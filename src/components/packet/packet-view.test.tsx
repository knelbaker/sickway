import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PacketView } from "@/components/packet/packet-view";
import { StudentFlow } from "@/components/student/student-flow";
import { sampleEncounterDetailResponse, samplePacketDetailResponse } from "@/lib/api-contracts";
import type { PacketView as PacketViewData } from "@/lib/packet-view";

const SESSION = "a".repeat(32);

const packet: PacketViewData = {
  ...samplePacketDetailResponse,
  id: "enc-1",
  encounterId: "enc-1",
  therapyId: "therapy-generic-demo",
  pharmacyId: "pharmacy-demo-a",
  mockPrice: 12,
  instructionLanguages: ["en", "es"],
  display: {
    patientName: "Alex Demo",
    therapyName: "Fictional Generic Antiviral Demo",
    generic: true,
    pharmacyName: "Fictional Demo Pharmacy A",
    planName: "Fictional Demo Out-of-State PPO",
    coverageStatus: "Mock covered",
    coverageMockLabel: "Mock coverage — not verified",
    stockStatus: "Mock in stock",
    instructions: [
      { language: "en", mockLabel: "Demo text — not clinically validated", title: "Demo packet instructions", steps: ["Review the fictional option."], disclaimer: "Prototype workflow." },
      { language: "es", mockLabel: "Texto de demostración — sin validación clínica", title: "Instrucciones del paquete de demostración", steps: ["Revise la opción ficticia."], disclaimer: "Flujo de trabajo de un prototipo." },
    ],
    resources: [],
  },
};

let respond: (path: string) => Response;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async (path: string) => respond(path)));
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

const tick = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

test("shows the therapy, pharmacy, stored price, and coverage, each with a synthetic or mock label", async () => {
  respond = () => Response.json(packet);
  render(<PacketView packetId="enc-1" />);
  await tick();

  expect(screen.getByRole("heading", { name: "Demo packet for Alex Demo" })).toBeDefined();
  expect(screen.getByText("Available in demo")).toBeDefined();
  const row = (label: string) => screen.getByText(label).parentElement as HTMLElement;
  expect(row("Demo therapy").textContent).toContain("Fictional Generic Antiviral Demo");
  expect(row("Demo therapy").textContent).toContain("Synthetic — fictional therapy");
  expect(row("Pharmacy").textContent).toContain("Fictional pharmacy");
  expect(row("Estimated cost").textContent).toBe("Estimated cost$12Mock cost");
  expect(row("Coverage").textContent).toContain("Mock coverage — not verified");
});

test("renders each selected language from the prewritten copy with its not-validated label", async () => {
  respond = () => Response.json(packet);
  render(<PacketView packetId="enc-1" />);
  await tick();

  const spanish = screen.getByText(/Instrucciones del paquete de demostración/).closest("section") as HTMLElement;
  expect(spanish.getAttribute("lang")).toBe("es");
  expect(within(spanish).getByText("Revise la opción ficticia.")).toBeDefined();
  expect(within(spanish).getByText("Texto de demostración — sin validación clínica")).toBeDefined();
  expect(screen.getByText("Demo text — not clinically validated")).toBeDefined();
});

test("the page's own wording never implies a prescription, booking, or delivery", async () => {
  respond = () => Response.json({ ...packet, display: { ...packet.display, instructions: [] } });
  const { container } = render(<PacketView packetId="enc-1" />);
  await tick();

  const text = container.textContent ?? "";
  expect(text).not.toMatch(/prescription sent|appointment confirmed|\bbooked\b|\bsent\b|\bconfirmed\b|\bordered\b|\bdelivered\b/i);
  expect(text).toContain("No prescription was written");
});

test("lists attached manufacturer resources with the fictional label", async () => {
  respond = () =>
    Response.json({
      ...packet,
      display: {
        ...packet.display,
        resources: [{ id: "resource-demo-copay", therapyId: "therapy-brand-demo", type: "copay_card", title: "Fictional Demo Copay Card", description: "Static sample only.", mockLabel: "Manufacturer resource — fictional demo" }],
      },
    });
  render(<PacketView packetId="enc-1" />);
  await tick();

  const region = screen.getByRole("region", { name: "Included by the demo clinician" });
  expect(within(region).getByText("Manufacturer resource — fictional demo")).toBeDefined();
});

test.each([404, 401])("shows an unavailable state and no packet data for a %i", async (status) => {
  respond = () => Response.json({ error: "packet_not_found" }, { status });
  render(<PacketView packetId="someone-elses" />);
  await tick();

  expect(screen.getByRole("heading", { name: "Packet unavailable" })).toBeDefined();
  expect(screen.getByText(/not available in this demo session/)).toBeDefined();
  expect(screen.queryByText("Available in demo")).toBeNull();
});

test("the student screen shows the packet link on its own once the clinician attaches", async () => {
  window.sessionStorage.setItem(`sickday.submitted.${SESSION}`, JSON.stringify({ encounterId: "enc-1", status: "ready" }));
  let encounter = { ...sampleEncounterDetailResponse, id: "enc-1", status: "ready" as string, packetId: undefined as string | undefined };
  respond = () => Response.json(encounter);
  render(
    <StudentFlow
      profile={{ name: "Alex Demo", age: 20, planName: "Fictional Demo Out-of-State PPO", planMockLabel: "Mock coverage — not verified", instructionLanguages: ["en", "es"], costCeiling: 25, fixtureClock: "2026-09-19T10:00:00-04:00" }}
    />,
  );
  await tick();
  expect(screen.getByText("Shared with the demo clinic")).toBeDefined();
  expect(screen.queryByRole("link", { name: "Open demo packet" })).toBeNull();

  encounter = { ...encounter, status: "packet_available", packetId: "enc-1" };
  await tick(2000);

  expect(screen.getByRole("link", { name: "Open demo packet" }).getAttribute("href")).toBe("/packet/enc-1");
  expect(screen.getByText("Booking not connected.")).toBeDefined();
});
