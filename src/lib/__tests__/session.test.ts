// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { store, configuration } = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
  configuration: { DEMO_SESSION_SECRET: "test-session-secret" },
}));

vi.mock("@/lib/env", () => ({ env: configuration }));

// In-memory stand-in for the session-partitioned table.
vi.mock("@/lib/db", () => ({
  sk: { meta: () => "META" },
  ttlFromNow: (seconds = 24 * 60 * 60) => Math.floor(Date.now() / 1000) + seconds,
  putItemIfAbsent: async (sessionId: string, sortKey: string, record: Record<string, unknown>) => {
    const key = `${sessionId}|${sortKey}`;
    if (store.has(key)) return false;
    store.set(key, record);
    return true;
  },
  getItem: async (sessionId: string, sortKey: string) => store.get(`${sessionId}|${sortKey}`) ?? null,
  updateItem: async (sessionId: string, sortKey: string, fields: Record<string, unknown>) => {
    const item = store.get(`${sessionId}|${sortKey}`);
    if (!item) return null;
    Object.assign(item, fields);
    return item;
  },
}));

import {
  createDemoSession,
  resetDemoSession,
  createSessionToken,
  requireSession,
  SESSION_HEADER,
  verifySessionToken,
} from "@/lib/session";

const NOW = new Date("2026-09-19T12:00:00.000Z");
const SESSION_A = "a".repeat(32);
const SESSION_B = "b".repeat(32);

function request(token?: string) {
  return new Request("http://localhost/api/anything", {
    headers: token === undefined ? {} : { [SESSION_HEADER]: token },
  });
}

beforeEach(() => {
  store.clear();
  configuration.DEMO_SESSION_SECRET = "test-session-secret";
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("session tokens", () => {
  it("round-trips a session ID", () => {
    expect(verifySessionToken(createSessionToken(SESSION_A))).toBe(SESSION_A);
  });

  it("rejects a token whose session ID was swapped for another session's", () => {
    const signature = createSessionToken(SESSION_A).split(".")[1];

    expect(verifySessionToken(`${SESSION_B}.${signature}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = createSessionToken(SESSION_A);
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");

    expect(verifySessionToken(flipped)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken(SESSION_A);
    configuration.DEMO_SESSION_SECRET = "rotated-secret";

    expect(verifySessionToken(token)).toBeNull();
  });

  it.each([null, undefined, "", "no-separator", ".onlysignature", `${SESSION_A}.`, "SESSION#x.sig", "short.sig"])(
    "rejects the malformed token %j",
    (token) => {
      expect(verifySessionToken(token)).toBeNull();
    },
  );
});

describe("createDemoSession", () => {
  it("stores META with the fixture profile, fixture clock, and a ttl", async () => {
    const { session, token } = await createDemoSession();

    expect(session.id).toMatch(/^[a-f0-9]{32}$/);
    expect(verifySessionToken(token)).toBe(session.id);
    expect(store.get(`${session.id}|META`)).toEqual({
      id: session.id,
      profileId: "demo-student-01",
      fixtureClock: "2026-09-19T10:00:00-04:00",
      createdAt: NOW.toISOString(),
      ttl: Math.floor(NOW.getTime() / 1000) + 24 * 60 * 60,
    });
  });

  it("issues unguessable, distinct session IDs", async () => {
    const first = await createDemoSession();
    const second = await createDemoSession();

    expect(first.session.id).not.toBe(second.session.id);
  });
});

describe("requireSession", () => {
  it("accepts a valid token for a stored session", async () => {
    const { session, token } = await createDemoSession();

    const auth = await requireSession(request(token));

    expect(auth).toEqual({ ok: true, session });
  });

  it("resolves each token to its own session only", async () => {
    const a = await createDemoSession();
    const b = await createDemoSession();

    const auth = await requireSession(request(a.token));

    expect(auth.ok && auth.session.id).toBe(a.session.id);
    expect(auth.ok && auth.session.id).not.toBe(b.session.id);
  });

  it.each([undefined, "", "garbage", `${SESSION_A}.forged`])(
    "returns 401 invalid_session for %j without reading any data",
    async (token) => {
      const auth = await requireSession(request(token));

      expect(auth.ok).toBe(false);
      if (auth.ok) return;
      expect(auth.response.status).toBe(401);
      expect(await auth.response.json()).toEqual({ error: "invalid_session" });
      expect(auth.response.headers.get("Cache-Control")).toBe("no-store");
    },
  );

  it("returns 401 for an authentic token whose session was never stored", async () => {
    const auth = await requireSession(request(createSessionToken(SESSION_A)));

    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(await auth.response.json()).toEqual({ error: "expired_session" });
  });

  it("returns 401 once the session ttl has passed, even if the record still exists", async () => {
    const { token } = await createDemoSession();
    vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * 60 * 1000 + 1000));

    const auth = await requireSession(request(token));

    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(await auth.response.json()).toEqual({ error: "expired_session" });
  });
});

describe("resetDemoSession", () => {
  it("creates a different session and leaves the old one answering only with the new token", async () => {
    const old = await createDemoSession();

    const next = await resetDemoSession(old.session);
    const oldAuth = await requireSession(request(old.token));
    const newAuth = await requireSession(request(next.token));

    expect(next.session.id).not.toBe(old.session.id);
    expect(newAuth.ok).toBe(true);
    expect(oldAuth.ok).toBe(false);
    if (oldAuth.ok) return;
    expect(oldAuth.response.status).toBe(409);
    expect(await oldAuth.response.json()).toEqual({ error: "session_superseded", joinToken: next.token });
  });

  it("never exposes the supersededByToken marker as part of the session", async () => {
    const old = await createDemoSession();
    const next = await resetDemoSession(old.session);

    const auth = await requireSession(request(next.token));

    expect(auth.ok && Object.keys(auth.session).sort()).toEqual(["createdAt", "fixtureClock", "id", "profileId", "ttl"]);
  });
});
