import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type Options = {
  clientTools: Record<string, (parameters: Record<string, unknown>) => Promise<string>>;
  onMessage: (payload: { message: string; role: "user" | "agent" }) => void;
  onError: (message: string) => void;
  onDisconnect: (details: { reason: string }) => void;
};

const sdk = vi.hoisted(() => ({
  options: undefined as unknown as Options,
  status: "disconnected",
  startSession: vi.fn(),
  endSession: vi.fn(),
}));

vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children }: { children: ReactNode }) => children,
  useConversation: (options: Options) => {
    sdk.options = options;
    return { status: sdk.status, isSpeaking: false, startSession: sdk.startSession, endSession: sdk.endSession };
  },
}));

import { VisitPanel } from "@/components/hcp/visit-panel";
import { sampleAttachResponse, sampleEncounterDetailResponse } from "@/lib/api-contracts";
import { buildOptionRows } from "@/lib/options";

const BRAND = "therapy-brand-demo";
const BRAND_NAME = "Fictional Brand Antiviral Demo";
const GENERIC_NAME = "Fictional Generic Antiviral Demo";
const copay = { id: "resource-demo-copay", therapyId: BRAND, type: "copay_card", title: "Fictional Demo Copay Card", description: "Static sample only.", mockLabel: "Manufacturer resource — fictional demo" };

let calls: { path: string; body: Record<string, unknown> }[];
let tokenReply: () => Response;
let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  calls = [];
  sdk.status = "disconnected";
  tokenReply = () => Response.json({ token: "conversation-token" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      calls.push({ path, body });
      if (path === "/api/voice/conversation-token") return tokenReply();
      if (path.endsWith("/options")) return Response.json({ found: true, rows: buildOptionRows() });
      if (path.endsWith("/resources")) {
        // Stand-in for the server rule: one named therapy AND a request for its resources.
        const text = String(body.text ?? "").toLowerCase();
        return text.includes(BRAND_NAME.toLowerCase()) && text.includes("resources")
          ? Response.json({ unlocked: true, therapyId: BRAND, resources: [copay] })
          : Response.json({ unlocked: false, reason: "No specific demo therapy was named." });
      }
      return Response.json(sampleAttachResponse);
    }),
  );
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  window.localStorage.setItem("sickday.demoSessionToken", `${"a".repeat(32)}.signature`);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.localStorage.clear();
});

function renderPanel(voiceEnabled: boolean, changes: Record<string, unknown> = {}) {
  render(<VisitPanel encounter={{ ...sampleEncounterDetailResponse, ...changes }} costCeiling={25} preferredLanguages={["en", "es"]} voiceEnabled={voiceEnabled} />);
}

const tool = (name: string, parameters: Record<string, unknown> = {}) => act(() => sdk.options.clientTools[name](parameters));
const clinicianSays = (message: string) => act(() => sdk.options.onMessage({ message, role: "user" }));
const attachCalls = () => calls.filter((call) => call.path.endsWith("/attach"));

describe("availability", () => {
  test("renders no voice control in baseline mode and leaves the typed flow unchanged", () => {
    renderPanel(false);

    expect(screen.queryByRole("button", { name: "Start voice" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show antiviral demo options" })).toBeDefined();
  });

  test.each([{ status: "needs_review" }, { status: "packet_available", packetId: "p1" }])(
    "offers no voice for an encounter that cannot take a packet (%j)",
    (changes) => {
      renderPanel(true, changes);

      expect(screen.queryByRole("button", { name: "Start voice" })).toBeNull();
    },
  );
});

describe("starting", () => {
  test("asks for the microphone, gets a server token with the session token, and starts a private WebRTC session", async () => {
    renderPanel(true);

    fireEvent.click(screen.getByRole("button", { name: "Start voice" }));

    await waitFor(() => expect(sdk.startSession).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(sdk.startSession).toHaveBeenCalledWith({ conversationToken: "conversation-token", connectionType: "webrtc" });
    const [, init] = vi.mocked(fetch).mock.calls.find(([path]) => path === "/api/voice/conversation-token")!;
    expect(new Headers((init as RequestInit).headers).get("x-demo-session")).toContain(".signature");
  });

  test("a denied microphone shows a notice, starts nothing, and leaves typed controls usable", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    renderPanel(true);

    fireEvent.click(screen.getByRole("button", { name: "Start voice" }));

    expect(await screen.findByText(/Microphone access was not granted/)).toBeDefined();
    expect(sdk.startSession).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Show antiviral demo options" }));
    expect(await screen.findByRole("table")).toBeDefined();
  });

  test("an unavailable token shows a notice and starts nothing", async () => {
    tokenReply = () => Response.json({ error: "voice_unavailable" }, { status: 503 });
    renderPanel(true);

    fireEvent.click(screen.getByRole("button", { name: "Start voice" }));

    expect(await screen.findByText(/Voice is unavailable right now/)).toBeDefined();
    expect(sdk.startSession).not.toHaveBeenCalled();
  });

  test("a dropped connection is announced and typed controls keep working", async () => {
    renderPanel(true);

    act(() => sdk.options.onDisconnect({ reason: "error" }));

    expect(await screen.findByText(/Voice disconnected. The typed controls below do everything voice does/)).toBeDefined();
    expect((screen.getByRole("button", { name: "Show antiviral demo options" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("ends the session when the view closes, so no conversation keeps running", () => {
    renderPanel(true);
    cleanup();

    expect(sdk.endSession).toHaveBeenCalled();
  });
});

describe("tools use the same controls and server rules as typing", () => {
  test("show_options puts the same table on screen, returns labelled mock data, and never calls the resources route", async () => {
    renderPanel(true);

    const heard = await tool("show_options", { query: "Show the antiviral demo options and sample costs" });

    expect(await screen.findByRole("table")).toBeDefined();
    expect(heard).toContain("mock cost 12 dollars");
    expect(heard).toContain("Manufacturer resources are still locked");
    expect(calls.map((call) => call.path)).toEqual(["/api/encounters/enc-demo-001/options"]);
  });

  test("the resource gate judges the clinician's own words: an agent that rewrites the request cannot unlock anything", async () => {
    renderPanel(true);
    await tool("show_options", { query: "antiviral options" });
    clinicianSays("tell me about the brand option");

    const heard = await tool("request_manufacturer_resources", { request: `Show manufacturer resources for ${BRAND_NAME}` });

    expect(calls.at(-1)).toEqual({ path: "/api/encounters/enc-demo-001/resources", body: { text: "tell me about the brand option" } });
    expect(heard).toContain("Manufacturer resources remain locked");
    expect(within(screen.getByRole("region", { name: "Manufacturer resources" })).queryByText("Fictional Demo Copay Card")).toBeNull();
  });

  test("a spoken request that names the therapy and asks for its resources unlocks only that therapy", async () => {
    renderPanel(true);
    await tool("show_options", { query: "antiviral options" });
    clinicianSays(`Show manufacturer resources for ${BRAND_NAME}`);

    const heard = await tool("request_manufacturer_resources", { request: "ignored" });

    expect(heard).toContain(`Unlocked for ${BRAND_NAME} only`);
    expect(await within(screen.getByRole("region", { name: "Manufacturer resources" })).findByText("Fictional Demo Copay Card")).toBeDefined();
  });

  test("with nothing heard from the clinician, the resources tool contacts no server", async () => {
    renderPanel(true);

    const heard = await tool("request_manufacturer_resources", { request: `Show manufacturer resources for ${BRAND_NAME}` });

    expect(heard).toContain("typed controls");
    expect(calls).toEqual([]);
  });

  test("propose_packet opens the confirmation dialog and stores nothing until the clinician confirms on screen", async () => {
    renderPanel(true);
    await tool("show_options", { query: "antiviral options" });

    const heard = await tool("propose_packet", { therapy_name: "fictional generic anti viral demo", pharmacy_name: "Fictional Demo Pharmacy A", languages: "es" });

    expect(heard).toContain("Nothing has been attached");
    expect(heard).toContain("Only the clinician can attach");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(GENERIC_NAME)).toBeDefined();
    expect(dialog.textContent).toContain("Spanish — prewritten demo text");
    expect(attachCalls()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and attach" }));

    await waitFor(() => expect(attachCalls()).toHaveLength(1));
    expect(attachCalls()[0].body).toMatchObject({ confirmed: true, therapyId: "therapy-generic-demo", pharmacyId: "pharmacy-demo-a", mockPrice: 12, instructionLanguages: ["es"], resourceIds: [] });
  });

  test("no tool exists that can confirm or attach", () => {
    renderPanel(true);

    expect(Object.keys(sdk.options.clientTools).sort()).toEqual(["propose_packet", "request_manufacturer_resources", "show_options"]);
  });

  test.each([
    ["before the options are on screen", false, { therapy_name: GENERIC_NAME, pharmacy_name: "Fictional Demo Pharmacy A", languages: "both" }, "Call show_options first"],
    ["for a vague choice", true, { therapy_name: "the cheap one", pharmacy_name: "Fictional Demo Pharmacy A", languages: "both" }, "is not in the options table"],
  ])("propose_packet opens nothing %s", async (_label, showFirst, choice, expected) => {
    renderPanel(true);
    if (showFirst) await tool("show_options", { query: "antiviral options" });

    expect(await tool("propose_packet", choice)).toContain(expected);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("transcript", () => {
  test("shows what the clinician and the agent said", async () => {
    renderPanel(true);

    clinicianSays("Show the antiviral demo options");
    act(() => sdk.options.onMessage({ message: "The options are on screen. All values are mock.", role: "agent" }));

    const transcript = await screen.findByRole("list", { name: "Voice transcript" });
    expect(within(transcript).getByText("Show the antiviral demo options")).toBeDefined();
    expect(within(transcript).getByText("The options are on screen. All values are mock.")).toBeDefined();
  });
});
