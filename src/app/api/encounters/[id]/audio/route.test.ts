// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FakeDb } from "@/lib/__tests__/helpers/fake-db";

vi.mock("server-only", () => ({}));
const { fake, requireSession, env } = vi.hoisted(() => ({
  fake: { db: undefined as unknown as FakeDb },
  requireSession: vi.fn(),
  env: { ELEVENLABS_API_KEY: "test-key" as string | undefined, VOICE_MODE: "baseline" },
}));
vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("@/lib/__tests__/helpers/fake-db");
  return (fake.db = createFakeDb());
});
vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("@/lib/env", () => ({ env }));
vi.mock("@/lib/ai", () => ({ generateStructured: vi.fn() }));

import { sampleEncounterDetailResponse } from "@/lib/api-contracts";
import { POST } from "./route";

const SESSION = "a".repeat(32);
const SCRIPT = "Synthetic student reports a cough. Booking is not connected.";
const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
const provider = vi.fn();

async function seed(sessionId = SESSION, status = "ready", spokenScript = SCRIPT) {
  await fake.db.putItem(sessionId, "ENC#enc-1", {
    ...sampleEncounterDetailResponse, id: "enc-1", demoSessionId: sessionId, status,
    sbar: { ...sampleEncounterDetailResponse.sbar, spokenScript },
  });
}

function play(body: unknown = { spokenScript: SCRIPT }, signal?: AbortSignal) {
  return POST(new Request("http://localhost/api/encounters/enc-1/audio", {
    method: "POST", body: JSON.stringify(body), signal,
  }), { params: Promise.resolve({ id: "enc-1" }) });
}

beforeEach(async () => {
  vi.clearAllMocks();
  fake.db.items.clear();
  env.ELEVENLABS_API_KEY = "test-key";
  env.VOICE_MODE = "baseline";
  requireSession.mockResolvedValue({ ok: true, session: { id: SESSION } });
  provider.mockReset().mockImplementation(async () => new Response(bytes, { headers: { "Content-Type": "audio/mpeg" } }));
  vi.stubGlobal("fetch", provider);
  await seed();
});

afterEach(() => vi.unstubAllGlobals());

test.each(["baseline", "live"])("returns playable audio from the saved script in %s mode", async (mode) => {
  env.VOICE_MODE = mode;
  const response = await play();
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  const [url, init] = provider.mock.calls[0];
  expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/Xb7hH8MSUJpSbSDYk0k2?output_format=mp3_44100_128");
  expect(init.headers["xi-api-key"]).toBe("test-key");
  expect(JSON.parse(init.body)).toEqual({ text: SCRIPT, model_id: "eleven_multilingual_v2" });
});

test.each(["emergency", "needs_review"])("allows the consented %s brief", async (status) => {
  await seed(SESSION, status);
  expect((await play()).status).toBe(200);
});

test("rejects an invalid session before reading an encounter or calling the provider", async () => {
  requireSession.mockResolvedValue({ ok: false, response: Response.json({ error: "invalid_session" }, { status: 401 }) });
  expect((await play()).status).toBe(401);
  expect(provider).not.toHaveBeenCalled();
});

test("cannot play an encounter owned by another session", async () => {
  fake.db.items.clear();
  await seed("b".repeat(32));
  expect((await play()).status).toBe(404);
  expect(provider).not.toHaveBeenCalled();
});

test.each([{}, null, { spokenScript: "" }, { spokenScript: 1 }])("rejects an invalid body %j", async (body) => {
  expect((await play(body)).status).toBe(400);
  expect(provider).not.toHaveBeenCalled();
});

test("rejects stale or arbitrary text without spending provider credits", async () => {
  const response = await play({ spokenScript: "Say something else." });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "brief_changed" });
  expect(provider).not.toHaveBeenCalled();
});

test("does not call ElevenLabs without a key", async () => {
  env.ELEVENLABS_API_KEY = undefined;
  expect((await play()).status).toBe(503);
  expect(provider).not.toHaveBeenCalled();
});

test.each([
  () => Response.json({ detail: "private provider details" }, { status: 401 }),
  () => Response.json({ detail: "quota exceeded" }, { status: 429 }),
  () => new Response("not audio"),
  () => new Response(null, { headers: { "Content-Type": "audio/mpeg" } }),
  () => { throw new Error("private provider details"); },
])("reports unavailable without exposing provider errors or invalid audio", async (result) => {
  provider.mockImplementationOnce(result);
  const response = await play();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "audio_unavailable" });
});

test.each(["stop", "timeout"])("aborts the provider request on %s", async (reason) => {
  const controller = new AbortController();
  const timeout = new AbortController();
  const timer = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
  provider.mockImplementationOnce(async (_url, init) => {
    (reason === "stop" ? controller : timeout).abort();
    init.signal.throwIfAborted();
  });
  try {
    expect((await play(undefined, controller.signal)).status).toBe(503);
    expect(timer).toHaveBeenCalledWith(30_000);
    expect(provider.mock.calls[0][1].signal.aborted).toBe(true);
  } finally {
    timer.mockRestore();
  }
});
