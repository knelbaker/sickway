// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { configuration, requireSession } = vi.hoisted(() => ({
  configuration: {
    VOICE_MODE: "live" as "live" | "baseline",
    ELEVENLABS_API_KEY: "sk_test_key" as string | undefined,
    NEXT_PUBLIC_DOORWAY_AGENT_ID: "agent_test" as string | undefined,
  },
  requireSession: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: configuration }));
vi.mock("@/lib/session", () => ({ requireSession }));

import { POST as conversationToken } from "./conversation-token/route";
import { POST as scribeToken } from "./scribe-token/route";

const request = () => new Request("http://localhost/api/voice/x", { method: "POST" });
let upstream: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.assign(configuration, { VOICE_MODE: "live", ELEVENLABS_API_KEY: "sk_test_key", NEXT_PUBLIC_DOORWAY_AGENT_ID: "agent_test" });
  requireSession.mockResolvedValue({ ok: true, session: { id: "a".repeat(32) } });
  upstream = vi.fn().mockResolvedValue(Response.json({ token: "short-lived-token" }));
  vi.stubGlobal("fetch", upstream);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe.each([
  ["conversation token", conversationToken, "https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agent_test", "GET"],
  ["scribe token", scribeToken, "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", "POST"],
] as const)("%s", (_name, route, url, method) => {
  it("mints a token with the server-side key and never returns the key", async () => {
    const response = await route(request());
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ token: "short-lived-token" });
    expect(text).not.toContain("sk_test_key");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const [calledUrl, init] = upstream.mock.calls[0];
    expect(calledUrl).toBe(url);
    expect(init.method).toBe(method);
    expect(init.headers["xi-api-key"]).toBe("sk_test_key");
  });

  it("requires a paired demo session before contacting ElevenLabs", async () => {
    requireSession.mockResolvedValue({ ok: false, response: Response.json({ error: "invalid_session" }, { status: 401 }) });

    expect((await route(request())).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("does not exist in baseline mode", async () => {
    configuration.VOICE_MODE = "baseline";

    expect((await route(request())).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("does not exist without an API key", async () => {
    configuration.ELEVENLABS_API_KEY = undefined;

    expect((await route(request())).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each([
    ["an upstream error", () => Promise.resolve(Response.json({ detail: "invalid sk_test_key" }, { status: 401 }))],
    ["a network failure", () => Promise.reject(new Error("socket hang up sk_test_key"))],
    ["a response without a token", () => Promise.resolve(Response.json({}))],
  ])("returns a generic 503 on %s", async (_label, reply) => {
    upstream.mockImplementation(reply);

    const response = await route(request());
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toBe('{"error":"voice_unavailable"}');
  });
});

describe("clinician agent", () => {
  it("is unavailable without an agent ID, while dictation still works", async () => {
    configuration.NEXT_PUBLIC_DOORWAY_AGENT_ID = undefined;

    expect((await conversationToken(request())).status).toBe(404);
    expect((await scribeToken(request())).status).toBe(200);
  });
});
