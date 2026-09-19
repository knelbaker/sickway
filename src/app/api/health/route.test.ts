// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { db, generateStructured } = vi.hoisted(() => ({
  db: {
    putItemIfAbsent: vi.fn(),
    getItem: vi.fn(),
    deleteItem: vi.fn(),
  },
  generateStructured: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { DEMO_SESSION_SECRET: "test-session-secret" } }));
vi.mock("@/lib/db", () => ({
  ...db,
  sk: { encounter: (id: string) => `ENC#${id}` },
}));
vi.mock("@/lib/ai", () => ({ generateStructured }));

import { GET } from "./route";

function request(key?: string) {
  return new Request("http://localhost/api/health", {
    headers: key === undefined ? {} : { "x-health-key": key },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.putItemIfAbsent.mockResolvedValue(true);
  db.getItem.mockResolvedValue({ id: "probe", probe: "health" });
  db.deleteItem.mockResolvedValue(undefined);
  generateStructured.mockResolvedValue({ ok: true, data: { ok: true }, cached: false });
});

describe("GET /api/health", () => {
  it.each([undefined, "", "wrong-secret", "test-session-secret-extra"])(
    "returns 404 and touches no service for the key %j",
    async (key) => {
      const response = await GET(request(key));

      expect(response.status).toBe(404);
      expect(db.putItemIfAbsent).not.toHaveBeenCalled();
      expect(generateStructured).not.toHaveBeenCalled();
    },
  );

  it("reports both services healthy and cleans up its probe item", async () => {
    const response = await GET(request("test-session-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.dynamodb).toMatchObject({ ok: true });
    expect(body.gemini).toMatchObject({ ok: true });
    expect(typeof body.dynamodb.latencyMs).toBe("number");
    expect(db.deleteItem).toHaveBeenCalledTimes(1);

    // The probe lives in a throwaway partition, never a demo session.
    const sessionId = db.putItemIfAbsent.mock.calls[0][0];
    expect(sessionId).toMatch(/^health-/);
    expect(generateStructured.mock.calls[0][0].sessionId).toBe(sessionId);
  });

  it("reports a Gemini failure with a generic reason while DynamoDB stays healthy", async () => {
    generateStructured.mockResolvedValue({ ok: false, reason: "provider_error" });

    const response = await GET(request("test-session-secret"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.dynamodb.ok).toBe(true);
    expect(body.gemini).toMatchObject({ ok: false, reason: "provider_error" });
  });

  it("never echoes provider error details or configuration", async () => {
    db.putItemIfAbsent.mockRejectedValue(
      new Error("AccessDenied for AKIAEXAMPLEKEY on arn:aws:dynamodb:us-east-1:1234:table/x"),
    );

    const response = await GET(request("test-session-secret"));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text).dynamodb).toMatchObject({ ok: false, reason: "error" });
    expect(text).not.toContain("AKIA");
    expect(text).not.toContain("arn:aws");
    expect(text).not.toContain("test-session-secret");
  });
});
