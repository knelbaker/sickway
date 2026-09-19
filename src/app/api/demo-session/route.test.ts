// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoSessionResponseSchema } from "@/lib/api-contracts";

vi.mock("server-only", () => ({}));

const session = vi.hoisted(() => ({
  createDemoSession: vi.fn(),
  requireSession: vi.fn(),
  createSessionToken: (id: string) => `${id}.signature`,
}));
vi.mock("@/lib/session", () => session);

import { GET, POST } from "./route";

const stored = {
  id: "a".repeat(32),
  profileId: "demo-student-01" as const,
  fixtureClock: "2026-09-19T10:00:00-04:00",
  createdAt: "2026-09-19T12:00:00.000Z",
  ttl: 1790000000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/demo-session", () => {
  it("creates a session and returns the contract shape with its token", async () => {
    session.createDemoSession.mockResolvedValue({ session: stored, token: `${stored.id}.signature` });

    const response = await POST();
    const body = demoSessionResponseSchema.parse(await response.json());

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      sessionId: stored.id,
      token: `${stored.id}.signature`,
      profileId: "demo-student-01",
      fixtureClock: stored.fixtureClock,
    });
  });

  it("returns 503 without details when persistence fails", async () => {
    session.createDemoSession.mockRejectedValue(new Error("AccessDenied arn:aws:dynamodb"));

    const response = await POST();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"session_unavailable"}');
  });
});

describe("GET /api/demo-session", () => {
  it("describes the caller's session", async () => {
    session.requireSession.mockResolvedValue({ ok: true, session: stored });

    const response = await GET(new Request("http://localhost/api/demo-session"));

    expect(response.status).toBe(200);
    expect(demoSessionResponseSchema.parse(await response.json()).sessionId).toBe(stored.id);
  });

  it("passes through the guard's 401", async () => {
    session.requireSession.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "invalid_session" }, { status: 401 }),
    });

    const response = await GET(new Request("http://localhost/api/demo-session"));

    expect(response.status).toBe(401);
  });
});
