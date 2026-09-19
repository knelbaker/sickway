import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BriefAudio } from "@/components/hcp/brief-audio";

const PREPARED = "Alex Demo reports fever to 102 degrees. Booking is not connected.";
const CHANGED = "Alex Demo reports fever to 100.4 degrees. Booking is not connected.";

let play: ReturnType<typeof vi.fn<() => Promise<void>>>;
let pause: ReturnType<typeof vi.fn<() => void>>;
let speak: ReturnType<typeof vi.fn>;
let cancel: ReturnType<typeof vi.fn>;

function enableSpeech() {
  speak = vi.fn();
  cancel = vi.fn();
  vi.stubGlobal("speechSynthesis", { speak, cancel });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      lang = "";
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
}

beforeEach(() => {
  play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  pause = vi.fn<() => void>();
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(pause);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("plays the prepared recording for the matching brief and labels it as prepared, only on Play", async () => {
  enableSpeech();
  render(<BriefAudio script={PREPARED} preparedScript={PREPARED} />);

  expect(screen.getByRole("status").textContent).toBe("Prepared recording");
  expect(screen.getByText(/Not live voice/)).toBeDefined();
  expect(play).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));

  await waitFor(() => expect(screen.getByRole("button", { name: "Stop" })).toBeDefined());
  expect(play).toHaveBeenCalledTimes(1);
  expect(speak).not.toHaveBeenCalled();
});

test("speaks a changed brief with the browser and never touches the recording", () => {
  enableSpeech();
  const { container } = render(<BriefAudio script={CHANGED} preparedScript={PREPARED} />);

  expect(screen.getByRole("status").textContent).toBe("Browser speech");
  expect(container.querySelector("audio")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));

  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak.mock.calls[0][0].text).toBe(CHANGED);
  expect(play).not.toHaveBeenCalled();
});

test("shows an explicit unavailable state, with no Play button, when a changed brief cannot be spoken", () => {
  render(<BriefAudio script={CHANGED} preparedScript={PREPARED} />);

  expect(screen.getByRole("status").textContent).toBe("Audio unavailable — read the brief below");
  expect(screen.queryByRole("button")).toBeNull();
});

test("falls back to speaking the same script when the recording cannot play", async () => {
  enableSpeech();
  play.mockRejectedValue(new Error("NotSupportedError"));
  render(<BriefAudio script={PREPARED} preparedScript={PREPARED} />);

  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));

  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Browser speech"));
  expect(speak.mock.calls[0][0].text).toBe(PREPARED);
});

test("Stop halts playback", async () => {
  enableSpeech();
  render(<BriefAudio script={PREPARED} preparedScript={PREPARED} />);
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  fireEvent.click(await screen.findByRole("button", { name: "Stop" }));

  expect(pause).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Play brief" })).toBeDefined();
});
