import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BriefAudio } from "@/components/hcp/brief-audio";
import { setLanguage } from "@/lib/client/language-store";

const PREPARED = "Alex Demo reports fever to 102 degrees. Booking is not connected.";
const CHANGED = "Alex Demo reports fever to 100.4 degrees. Booking is not connected.";
const props = { encounterId: "enc-1", script: CHANGED, preparedScript: PREPARED };
const mp3 = () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });
let play: ReturnType<typeof vi.fn<() => Promise<void>>>;
let pause: ReturnType<typeof vi.fn<() => void>>;
let fetchAudio: ReturnType<typeof vi.fn>;
let browserSpeech: ReturnType<typeof vi.fn>;

test("keeps Spanish controls when switching language during playback without regenerating audio", async () => {
  render(<BriefAudio {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  act(() => setLanguage("es"));
  expect(screen.getByRole("status").textContent).toBe("Audio de ElevenLabs");
  fireEvent.click(screen.getByRole("button", { name: "Detener" }));
  fireEvent.click(screen.getByRole("button", { name: "Reproducir el resumen" }));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  expect(fetchAudio).toHaveBeenCalledTimes(1);
});

beforeEach(() => {
  localStorage.setItem("sickday.demoSessionToken", "session.token");
  play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  pause = vi.fn<() => void>();
  fetchAudio = vi.fn().mockImplementation(mp3);
  browserSpeech = vi.fn();
  vi.stubGlobal("fetch", fetchAudio);
  vi.stubGlobal("speechSynthesis", { speak: browserSpeech });
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  URL.createObjectURL = vi.fn().mockReturnValue("blob:brief-audio");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  expect(browserSpeech).not.toHaveBeenCalled();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("plays the exact prepared recording only on Play, without calling ElevenLabs", async () => {
  const { container } = render(<BriefAudio {...props} script={PREPARED} />);
  expect(screen.getByRole("status").textContent).toBe("Prepared recording");
  expect(screen.getByText(/Not live voice/)).toBeDefined();
  expect(play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Prepared recording"));
  expect(container.querySelector("audio")?.getAttribute("src")).toBe("/demo-brief.mp3");
  expect(play).toHaveBeenCalledTimes(1);
  expect(fetchAudio).not.toHaveBeenCalled();
});

test("requests the current saved brief with the session token and reuses the downloaded audio on replay", async () => {
  const { container, unmount } = render(<BriefAudio {...props} />);
  expect(fetchAudio).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  const [url, init] = fetchAudio.mock.calls[0];
  expect(url).toBe("/api/encounters/enc-1/audio");
  expect(init.method).toBe("POST");
  expect(init.headers.get("x-demo-session")).toBe("session.token");
  expect(JSON.parse(init.body)).toEqual({ spokenScript: CHANGED });
  expect(container.querySelector("audio")?.src).toBe("blob:brief-audio");
  expect(screen.getByRole("status").textContent).toBe("ElevenLabs audio");
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  expect(pause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  expect(fetchAudio).toHaveBeenCalledTimes(1);
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:brief-audio");
});

test("uses ElevenLabs for the same script if the prepared recording cannot play", async () => {
  play.mockRejectedValueOnce(new Error("NotSupportedError"));
  render(<BriefAudio {...props} script={PREPARED} />);
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetchAudio.mock.calls[0][1].body)).toEqual({ spokenScript: PREPARED });
  expect(screen.getByRole("status").textContent).toBe("ElevenLabs audio");
});

test.each([
  () => Response.json({ error: "audio_unavailable" }, { status: 503 }),
  () => Response.json({ error: "brief_changed" }, { status: 409 }),
  () => new Response("not audio"),
  () => new Response(null, { headers: { "content-type": "audio/mpeg" } }),
])("shows an unavailable state and permits retry without switching to browser speech", async (response) => {
  fetchAudio.mockImplementationOnce(response);
  render(<BriefAudio {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Audio unavailable — read the brief below"));
  expect(play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
});

test.each(["stop", "unmount", "change brief", "change encounter"])("cancels pending generation on %s and ignores a late response", async (action) => {
  let resolve!: (response: Response) => void;
  fetchAudio.mockReturnValue(new Promise<Response>((done) => { resolve = done; }));
  const view = render(<BriefAudio {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  expect(screen.getByRole("status").textContent).toBe("Preparing audio…");
  const signal = fetchAudio.mock.calls[0][1].signal;
  if (action === "stop") fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  if (action === "unmount") view.unmount();
  if (action === "change brief") view.rerender(<BriefAudio {...props} script={PREPARED} />);
  if (action === "change encounter") view.rerender(<BriefAudio {...props} encounterId="enc-2" />);
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(mp3()));
  expect(play).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  if (action !== "unmount") expect(screen.getByRole("button", { name: "Play brief" })).toBeDefined();
});

test("discards downloaded audio when the displayed brief changes", async () => {
  const view = render(<BriefAudio {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  await waitFor(() => expect(play).toHaveBeenCalled());
  view.rerender(<BriefAudio {...props} script="The new current brief." />);
  expect(pause).toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:brief-audio");
  expect(screen.getByRole("button", { name: "Play brief" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Play brief" }));
  await waitFor(() => expect(fetchAudio).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetchAudio.mock.calls[1][1].body)).toEqual({ spokenScript: "The new current brief." });
});
