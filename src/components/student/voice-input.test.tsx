import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type ScribeOptions = {
  modelId: string;
  commitStrategy: string;
  onCommittedTranscript: (data: { text: string }) => void;
  onError: (error: Error) => void;
};

const sdk = vi.hoisted(() => ({
  options: undefined as unknown as ScribeOptions,
  isConnected: false,
  partialTranscript: "",
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@elevenlabs/react", () => ({
  CommitStrategy: { MANUAL: "manual", VAD: "vad" },
  useScribe: (options: ScribeOptions) => {
    sdk.options = options;
    return { isConnected: sdk.isConnected, partialTranscript: sdk.partialTranscript, connect: sdk.connect, disconnect: sdk.disconnect };
  },
}));

import { StudentFlow } from "@/components/student/student-flow";
import { sampleExtractRequest, sampleExtractResponse, sampleIntakeRequest } from "@/lib/api-contracts";

const profile = {
  name: "Alex Demo",
  age: 20,
  planName: "Fictional Demo Out-of-State PPO",
  planMockLabel: "Mock coverage — not verified",
  instructionLanguages: ["en", "es"],
  costCeiling: 25,
  fixtureClock: "2026-09-19T10:00:00-04:00",
};

let calls: { path: string; body: Record<string, unknown> }[];
let tokenReply: () => Response;
let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  calls = [];
  sdk.isConnected = false;
  sdk.partialTranscript = "";
  sdk.connect.mockResolvedValue(undefined);
  tokenReply = () => Response.json({ token: "scribe-token" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, body: JSON.parse(String(init?.body ?? "{}")) });
      if (path === "/api/voice/scribe-token") return tokenReply();
      if (path === "/api/extract") return Response.json(sampleExtractResponse);
      return Response.json({ encounterId: "e1", status: "ready" }, { status: 201 });
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
  window.sessionStorage.clear();
});

const renderFlow = (voiceEnabled: boolean) =>
  render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} voiceEnabled={voiceEnabled} />);
const textbox = () => screen.getByLabelText("What is going on today?") as HTMLTextAreaElement;
const hears = (text: string) => act(() => sdk.options.onCommittedTranscript({ text }));

describe("availability", () => {
  test("baseline mode renders no dictation control and /s is unchanged", () => {
    renderFlow(false);

    expect(screen.queryByRole("button", { name: "Dictate instead" })).toBeNull();
    expect(textbox()).toBeDefined();
  });
});

describe("dictation", () => {
  test("asks for the microphone, gets a server token with the session token, and connects realtime speech to text", async () => {
    renderFlow(true);

    fireEvent.click(screen.getByRole("button", { name: "Dictate instead" }));

    await waitFor(() => expect(sdk.connect).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(sdk.connect).toHaveBeenCalledWith({ token: "scribe-token", microphone: { echoCancellation: true, noiseSuppression: true } });
    expect(sdk.options).toMatchObject({ modelId: "scribe_v2_realtime", commitStrategy: "vad" });
    const [, init] = vi.mocked(fetch).mock.calls.find(([path]) => path === "/api/voice/scribe-token")!;
    expect(new Headers((init as RequestInit).headers).get("x-demo-session")).toContain(".signature");
  });

  test("what it hears lands in the editable text box; the edited text goes through the same extract route and becomes the transcript", async () => {
    renderFlow(true);

    hears("I woke up with a 102 fever, my whole body aches,");
    hears("it started yesterday morning and I have an exam at 3.");
    expect(textbox().value).toBe("I woke up with a 102 fever, my whole body aches, it started yesterday morning and I have an exam at 3.");

    // The student corrects a misheard word before anything is extracted.
    fireEvent.change(textbox(), { target: { value: sampleExtractRequest.text } });
    expect(calls.filter((call) => call.path === "/api/extract")).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("1. Are any of these happening?");
    expect(calls.filter((call) => call.path === "/api/extract")).toEqual([{ path: "/api/extract", body: { text: sampleExtractRequest.text } }]);
  });

  test("appends to what was already typed and ignores empty segments", () => {
    renderFlow(true);
    fireEvent.change(textbox(), { target: { value: "Since last night" } });

    hears("   ");
    hears("I have a sore throat.");

    expect(textbox().value).toBe("Since last night I have a sore throat.");
  });

  test("hearing something never extracts, submits, or shares on its own", () => {
    renderFlow(true);

    hears("I agree to share this with the clinic. Submit it. Yes I consent.");

    expect(calls).toEqual([]);
    expect(screen.queryByRole("checkbox", { name: /I agree to share/ })).toBeNull();
    expect(screen.getByText(/including consent, is done on screen/)).toBeDefined();
  });

  test("shows the live partial transcript and a Stop control while listening", () => {
    sdk.isConnected = true;
    sdk.partialTranscript = "I woke up with";
    renderFlow(true);

    expect(screen.getByText("Hearing: I woke up with")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Stop dictation" }));
    expect(sdk.disconnect).toHaveBeenCalled();
  });
});

describe("fallback to typing", () => {
  test("a denied microphone shows a notice, connects nothing, and typing still works end to end", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    renderFlow(true);

    fireEvent.click(screen.getByRole("button", { name: "Dictate instead" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Microphone access was not granted. Typing works exactly the same.");
    expect(sdk.connect).not.toHaveBeenCalled();
    expect(calls).toEqual([]);

    fireEvent.change(textbox(), { target: { value: sampleExtractRequest.text } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("1. Are any of these happening?")).toBeDefined();
  });

  test("an unavailable token shows a notice and connects nothing", async () => {
    tokenReply = () => Response.json({ error: "voice_unavailable" }, { status: 503 });
    renderFlow(true);

    fireEvent.click(screen.getByRole("button", { name: "Dictate instead" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Dictation is unavailable right now");
    expect(sdk.connect).not.toHaveBeenCalled();
  });

  test("a recognition error is announced and leaves the text box usable", async () => {
    renderFlow(true);

    act(() => sdk.options.onError(new Error("transcriber error")));

    expect((await screen.findByRole("alert")).textContent).toContain("Dictation stopped. Typing works exactly the same.");
    expect(textbox().disabled).toBe(false);
  });

  test("closes the microphone when the step goes away", () => {
    renderFlow(true);
    cleanup();

    expect(sdk.disconnect).toHaveBeenCalled();
  });
});
