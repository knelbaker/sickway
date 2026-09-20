// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleExtractRequest, sampleExtractResponse } from "@/lib/api-contracts";

vi.mock("server-only", () => ({}));

const { requireSession, extractIntake, db } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  extractIntake: vi.fn(),
  db: { putItem: vi.fn(), putItemIfAbsent: vi.fn(), updateItem: vi.fn() },
}));
vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("@/lib/intake", () => ({ extractIntake, MAX_INTAKE_TEXT_LENGTH: 2000 }));
vi.mock("@/lib/db", () => db);

import { POST } from "./route";

const session = { id: "a".repeat(32), fixtureClock: "2026-09-19T10:00:00-04:00" };

function post(body: unknown) {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ ok: true, session });
  extractIntake.mockResolvedValue({ ok: true, response: sampleExtractResponse });
});

describe("POST /api/extract", () => {
  it("returns candidate fields using the verified session and its fixture clock", async () => {
    const response = await POST(post(sampleExtractRequest));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(sampleExtractResponse);
    expect(extractIntake).toHaveBeenCalledWith(session.id, sampleExtractRequest.text, session.fixtureClock);
  });

  it("never writes an encounter or any other record", async () => {
    await POST(post(sampleExtractRequest));

    expect(db.putItem).not.toHaveBeenCalled();
    expect(db.putItemIfAbsent).not.toHaveBeenCalled();
    expect(db.updateItem).not.toHaveBeenCalled();
  });

  it("rejects a request without a valid session before extracting", async () => {
    requireSession.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "invalid_session" }, { status: 401 }),
    });

    const response = await POST(post(sampleExtractRequest));

    expect(response.status).toBe(401);
    expect(extractIntake).not.toHaveBeenCalled();
  });

  it.each([{}, { text: "" }, { text: "   " }, { text: "x".repeat(2001) }, "not json"])(
    "returns 400 for the invalid body %j",
    async (body) => {
      const response = await POST(post(body));

      expect(response.status).toBe(400);
      expect(extractIntake).not.toHaveBeenCalled();
    },
  );

  it.each(["timeout", "rate_limited"])("returns a typed 503 for %s and no fixture data", async (reason) => {
    extractIntake.mockResolvedValue({ ok: false, reason });

    const response = await POST(post(sampleExtractRequest));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "extraction_unavailable", reason });
  });
});
