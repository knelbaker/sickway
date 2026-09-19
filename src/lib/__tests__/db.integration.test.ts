// @vitest-environment node
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/**
 * Opt-in round trip against the real table. Skipped by default so `pnpm test`
 * never needs credentials or touches AWS:
 *
 *   RUN_DDB_INTEGRATION=1 pnpm test src/lib/__tests__/db.integration.test.ts
 *
 * Values come from the process environment, then `.env.local`, then `.env`.
 */

vi.mock("server-only", () => ({}));

const AWS_VARIABLES = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "DDB_TABLE",
] as const;

// env.ts validates every server variable; this test only exercises DynamoDB.
const UNRELATED_VARIABLES = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_MODEL",
  "DEMO_SESSION_SECRET",
] as const;

const requested = process.env.RUN_DDB_INTEGRATION === "1";

if (requested) {
  // loadEnvFile never overrides a variable that is already set.
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

const configured = AWS_VARIABLES.every((name) => process.env[name]?.trim());

const noteSchema = z.object({
  id: z.string(),
  text: z.string(),
  tags: z.array(z.string()),
  ttl: z.number(),
});

describe.skipIf(!requested || !configured)("DynamoDB round trip", () => {
  const sessionId = `itest-${randomUUID()}`;
  const otherSessionId = `itest-${randomUUID()}`;
  let dbModule: typeof import("../db");

  beforeAll(async () => {
    for (const name of UNRELATED_VARIABLES) {
      if (!process.env[name]?.trim()) vi.stubEnv(name, "unused-by-this-test");
    }
    dbModule = await import("../db");
  });

  afterAll(async () => {
    await dbModule.deleteItem(sessionId, dbModule.sk.encounter("e1"));
    vi.unstubAllEnvs();
  });

  it("writes, reads, updates, lists, and deletes within one session", async () => {
    const { appendUniqueToList, deleteItem, getItem, putItemIfAbsent, queryByPrefix, sk, SK_PREFIX, updateItem } =
      dbModule;
    const key = sk.encounter("e1");
    const record = { id: "e1", text: "synthetic integration check", tags: [] };

    expect(await putItemIfAbsent(sessionId, key, record)).toBe(true);

    const stored = await getItem(sessionId, key, noteSchema);
    expect(stored).toMatchObject(record);
    expect(stored?.ttl).toBeGreaterThan(Date.now() / 1000);

    // A second conditional put reports "already exists" and leaves the item alone.
    expect(await putItemIfAbsent(sessionId, key, { ...record, text: "overwritten" })).toBe(false);
    expect((await getItem(sessionId, key, noteSchema))?.text).toBe(record.text);

    // Another session cannot see it.
    expect(await getItem(otherSessionId, key, noteSchema)).toBeNull();
    expect(await queryByPrefix(otherSessionId, SK_PREFIX.encounter, noteSchema)).toEqual([]);

    expect((await updateItem(sessionId, key, { text: "updated" }, noteSchema))?.text).toBe("updated");
    expect(await updateItem(otherSessionId, key, { text: "x" }, noteSchema)).toBeNull();

    expect(await appendUniqueToList(sessionId, key, "tags", "a")).toBe(true);
    expect(await appendUniqueToList(sessionId, key, "tags", "a")).toBe(false);

    const listed = await queryByPrefix(sessionId, SK_PREFIX.encounter, noteSchema);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: "e1", text: "updated", tags: ["a"] });

    await deleteItem(sessionId, key);
    expect(await getItem(sessionId, key, noteSchema)).toBeNull();
  }, 30_000);
});
