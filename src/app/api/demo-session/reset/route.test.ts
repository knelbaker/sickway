// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeDb } from "@/lib/__tests__/helpers/fake-db";

vi.mock("server-only", () => ({}));

const { fake } = vi.hoisted(() => ({ fake: { db: undefined as unknown as FakeDb } }));

vi.mock("@/lib/env", () => ({ env: { DEMO_SESSION_SECRET: "test-session-secret" } }));
vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("@/lib/__tests__/helpers/fake-db");
  return (fake.db = createFakeDb());
});
// The model is irrelevant here; every brief falls back to the deterministic summary.
vi.mock("@/lib/ai", () => ({ generateStructured: vi.fn().mockResolvedValue({ ok: false, reason: "provider_error" }) }));

import { POST as attach } from "@/app/api/encounters/[id]/attach/route";
import { GET as encounterDetail } from "@/app/api/encounters/[id]/route";
import { GET as queue } from "@/app/api/encounters/route";
import { POST as intake } from "@/app/api/intake/route";
import { GET as packetDetail } from "@/app/api/packet/[id]/route";
import { GET as describeSession, POST as startSession } from "@/app/api/demo-session/route";
import { sampleIntakeRequest } from "@/lib/api-contracts";
import { SESSION_HEADER } from "@/lib/session";
import { POST as reset } from "./route";

function request(path: string, token: string | null, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: token ? { [SESSION_HEADER]: token } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function completedRun() {
  const { token } = await (await startSession()).json();
  const { encounterId } = await (await intake(request("/api/intake", token, sampleIntakeRequest))).json();
  const { packetId } = await (
    await attach(
      request(`/api/encounters/${encounterId}/attach`, token, {
        confirmed: true,
        therapyId: "therapy-generic-demo",
        pharmacyId: "pharmacy-demo-a",
        mockPrice: 12,
        instructionLanguages: ["es"],
        resourceIds: [],
      }),
      params(encounterId),
    )
  ).json();
  return { token: token as string, encounterId: encounterId as string, packetId: packetId as string };
}

beforeEach(() => {
  fake.db.items.clear();
});

describe("POST /api/demo-session/reset", () => {
  it("creates a fresh session whose queue is empty and which cannot see the previous run", async () => {
    const old = await completedRun();
    expect(await (await queue(request("/api/encounters", old.token))).json()).toHaveLength(1);

    const response = await reset(request("/api/demo-session/reset", old.token, {}));
    const next = await response.json();

    expect(response.status).toBe(201);
    expect(next.sessionId).not.toBe(old.token.split(".")[0]);
    expect(await (await queue(request("/api/encounters", next.token))).json()).toEqual([]);
    expect((await encounterDetail(request(`/api/encounters/${old.encounterId}`, next.token), params(old.encounterId))).status).toBe(404);
    expect((await packetDetail(request(`/api/packet/${old.packetId}`, next.token), params(old.packetId))).status).toBe(404);
  });

  it("stops serving any data to the old token and points it at the new session", async () => {
    const old = await completedRun();
    const next = await (await reset(request("/api/demo-session/reset", old.token, {}))).json();

    const responses = await Promise.all([
      queue(request("/api/encounters", old.token)),
      encounterDetail(request(`/api/encounters/${old.encounterId}`, old.token), params(old.encounterId)),
      packetDetail(request(`/api/packet/${old.packetId}`, old.token), params(old.packetId)),
      describeSession(request("/api/demo-session", old.token)),
      intake(request("/api/intake", old.token, sampleIntakeRequest)),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "session_superseded", joinToken: next.token });
    }
    // The refused intake stored nothing in either session.
    expect([...fake.db.items.keys()].filter((key) => key.includes("|ENC#"))).toHaveLength(1);
  });

  it("follows a chain of resets from the oldest token to the newest session", async () => {
    const { token: first } = await (await startSession()).json();
    const second = await (await reset(request("/api/demo-session/reset", first, {}))).json();
    const third = await (await reset(request("/api/demo-session/reset", second.token, {}))).json();

    expect((await (await describeSession(request("/api/demo-session", first))).json()).joinToken).toBe(second.token);
    expect((await (await describeSession(request("/api/demo-session", second.token))).json()).joinToken).toBe(third.token);
    expect((await describeSession(request("/api/demo-session", third.token))).status).toBe(200);
  });

  it("two back-to-back runs never see each other's data", async () => {
    const first = await completedRun();
    const next = await (await reset(request("/api/demo-session/reset", first.token, {}))).json();
    await intake(request("/api/intake", next.token, { ...sampleIntakeRequest, intake: { ...sampleIntakeRequest.intake, symptoms: ["sore throat"] } }));

    const secondQueue = await (await queue(request("/api/encounters", next.token))).json();

    expect(secondQueue).toHaveLength(1);
    expect(secondQueue[0].chiefSymptoms).toEqual(["sore throat"]);
    expect(secondQueue[0].status).not.toBe("packet_available");
  });

  it("requires a valid session", async () => {
    expect((await reset(request("/api/demo-session/reset", null, {}))).status).toBe(401);
    expect(fake.db.items.size).toBe(0);
  });
});
