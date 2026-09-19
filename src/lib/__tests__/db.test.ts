// @vitest-environment node
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Next.js enforces this boundary; unit tests run outside its server runtime.
vi.mock("server-only", () => ({}));

const send = vi.hoisted(() => vi.fn());

// Keep the real command classes so tests can inspect `command.input`.
vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>()),
  DynamoDBDocumentClient: { from: () => ({ send }) },
}));

const NOW = new Date("2026-09-19T12:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);

const noteSchema = z.object({ id: z.string(), text: z.string() });

function conditionFailed() {
  return new ConditionalCheckFailedException({ message: "exists", $metadata: {} });
}

function sentInput(call = 0) {
  return send.mock.calls[call][0].input;
}

beforeEach(() => {
  vi.resetModules();
  send.mockReset();
  vi.useFakeTimers({ now: NOW });
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-google-key");
  vi.stubEnv("GEMINI_MODEL", "test-model");
  vi.stubEnv("AWS_REGION", "us-east-1");
  vi.stubEnv("AWS_ACCESS_KEY_ID", "test-access-key");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret-key");
  vi.stubEnv("DDB_TABLE", "test-table");
  vi.stubEnv("DEMO_SESSION_SECRET", "test-session-secret");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("key builders", () => {
  it("builds the session partition key and every sort key from sickway.md §8", async () => {
    const { pk, sk } = await import("../db");

    expect(pk("s1")).toBe("SESSION#s1");
    expect(sk.meta()).toBe("META");
    expect(sk.encounter("e1")).toBe("ENC#e1");
    expect(sk.packet("p1")).toBe("PKT#p1");
    expect(sk.event("2026-09-19T12:00:00.000Z", "v1")).toBe(
      "EVT#2026-09-19T12:00:00.000Z#v1",
    );
    expect(sk.cache("abc123")).toBe("CACHE#abc123");
  });

  it("exposes prefixes that match the sort keys they list", async () => {
    const { sk, SK_PREFIX } = await import("../db");

    expect(sk.encounter("e1").startsWith(SK_PREFIX.encounter)).toBe(true);
    expect(sk.packet("p1").startsWith(SK_PREFIX.packet)).toBe(true);
    expect(sk.event("t", "v1").startsWith(SK_PREFIX.event)).toBe(true);
    expect(sk.cache("h").startsWith(SK_PREFIX.cache)).toBe(true);
  });

  it.each(["", "   ", "a#b"])("rejects the unsafe id %j", async (id) => {
    const { pk, sk } = await import("../db");

    // A "#" inside an id could make one session's key collide with another's.
    expect(() => pk(id)).toThrow("Invalid key segment");
    expect(() => sk.encounter(id)).toThrow("Invalid key segment");
    expect(() => sk.packet(id)).toThrow("Invalid key segment");
  });
});

describe("ttlFromNow", () => {
  it("returns epoch seconds 24 hours ahead by default", async () => {
    const { ttlFromNow, SESSION_TTL_SECONDS } = await import("../db");

    expect(SESSION_TTL_SECONDS).toBe(24 * 60 * 60);
    expect(ttlFromNow()).toBe(NOW_SECONDS + SESSION_TTL_SECONDS);
    expect(ttlFromNow(60)).toBe(NOW_SECONDS + 60);
  });
});

describe("putItem", () => {
  it("writes into the session partition with a numeric ttl", async () => {
    send.mockResolvedValue({});
    const { putItem, sk } = await import("../db");

    await putItem("s1", sk.encounter("e1"), { id: "e1", text: "hello" });

    expect(sentInput()).toEqual({
      TableName: "test-table",
      Item: {
        id: "e1",
        text: "hello",
        PK: "SESSION#s1",
        SK: "ENC#e1",
        ttl: NOW_SECONDS + 24 * 60 * 60,
      },
    });
  });

  it("keeps a ttl the record already defines", async () => {
    send.mockResolvedValue({});
    const { putItem, sk } = await import("../db");

    await putItem("s1", sk.meta(), { id: "s1", ttl: 1234 });

    expect(sentInput().Item.ttl).toBe(1234);
  });

  it("never lets a record overwrite its own keys", async () => {
    send.mockResolvedValue({});
    const { putItem, sk } = await import("../db");

    await putItem("s1", sk.encounter("e1"), { PK: "SESSION#other", SK: "META" });

    expect(sentInput().Item).toMatchObject({ PK: "SESSION#s1", SK: "ENC#e1" });
  });
});

describe("putItemIfAbsent", () => {
  it("creates the item and reports true", async () => {
    send.mockResolvedValue({});
    const { putItemIfAbsent, sk } = await import("../db");

    await expect(putItemIfAbsent("s1", sk.packet("p1"), { id: "p1" })).resolves.toBe(true);
    expect(sentInput().ConditionExpression).toBe("attribute_not_exists(PK)");
    expect(sentInput().Item).toMatchObject({ PK: "SESSION#s1", SK: "PKT#p1" });
  });

  it("reports false without overwriting when the item already exists", async () => {
    send.mockRejectedValue(conditionFailed());
    const { putItemIfAbsent, sk } = await import("../db");

    await expect(putItemIfAbsent("s1", sk.packet("p1"), { id: "p1" })).resolves.toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("rethrows unrelated errors", async () => {
    send.mockRejectedValue(new Error("network down"));
    const { putItemIfAbsent, sk } = await import("../db");

    await expect(putItemIfAbsent("s1", sk.packet("p1"), { id: "p1" })).rejects.toThrow(
      "network down",
    );
  });
});

describe("getItem", () => {
  it("reads from the caller's session partition and strips the keys", async () => {
    send.mockResolvedValue({
      Item: { PK: "SESSION#s1", SK: "ENC#e1", ttl: 99, id: "e1", text: "hello" },
    });
    const { getItem, sk } = await import("../db");

    const item = await getItem("s1", sk.encounter("e1"), noteSchema);

    expect(item).toEqual({ id: "e1", text: "hello" });
    expect(sentInput()).toEqual({
      TableName: "test-table",
      Key: { PK: "SESSION#s1", SK: "ENC#e1" },
      ConsistentRead: true,
    });
  });

  it("returns null when the item is not in this session", async () => {
    send.mockResolvedValue({});
    const { getItem, sk } = await import("../db");

    await expect(getItem("s2", sk.encounter("e1"), noteSchema)).resolves.toBeNull();
    expect(sentInput().Key.PK).toBe("SESSION#s2");
  });

  it("rejects a stored item that does not match the schema", async () => {
    send.mockResolvedValue({ Item: { PK: "SESSION#s1", SK: "ENC#e1", id: "e1" } });
    const { getItem, sk } = await import("../db");

    await expect(getItem("s1", sk.encounter("e1"), noteSchema)).rejects.toThrow();
  });
});

describe("queryByPrefix", () => {
  it("queries only the session partition and follows pagination", async () => {
    send
      .mockResolvedValueOnce({
        Items: [{ PK: "SESSION#s1", SK: "ENC#e1", id: "e1", text: "one" }],
        LastEvaluatedKey: { PK: "SESSION#s1", SK: "ENC#e1" },
      })
      .mockResolvedValueOnce({
        Items: [{ PK: "SESSION#s1", SK: "ENC#e2", id: "e2", text: "two" }],
      });
    const { queryByPrefix, SK_PREFIX } = await import("../db");

    const items = await queryByPrefix("s1", SK_PREFIX.encounter, noteSchema);

    expect(items).toEqual([
      { id: "e1", text: "one" },
      { id: "e2", text: "two" },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(sentInput(0)).toMatchObject({
      TableName: "test-table",
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": "SESSION#s1", ":prefix": "ENC#" },
      ConsistentRead: true,
    });
    expect(sentInput(0).ExclusiveStartKey).toBeUndefined();
    expect(sentInput(1).ExclusiveStartKey).toEqual({ PK: "SESSION#s1", SK: "ENC#e1" });
  });

  it("returns an empty list for a session with no matching items", async () => {
    send.mockResolvedValue({ Items: [] });
    const { queryByPrefix, SK_PREFIX } = await import("../db");

    await expect(queryByPrefix("s1", SK_PREFIX.packet, noteSchema)).resolves.toEqual([]);
  });
});

describe("updateItem", () => {
  it("sets the given fields on an existing item and returns the result", async () => {
    send.mockResolvedValue({
      Attributes: { PK: "SESSION#s1", SK: "ENC#e1", ttl: 99, id: "e1", text: "updated" },
    });
    const { updateItem, sk } = await import("../db");

    const item = await updateItem("s1", sk.encounter("e1"), { text: "updated" }, noteSchema);

    expect(item).toEqual({ id: "e1", text: "updated" });
    expect(sentInput()).toEqual({
      TableName: "test-table",
      Key: { PK: "SESSION#s1", SK: "ENC#e1" },
      UpdateExpression: "SET #f0 = :v0",
      ExpressionAttributeNames: { "#f0": "text" },
      ExpressionAttributeValues: { ":v0": "updated" },
      ConditionExpression: "attribute_exists(PK)",
      ReturnValues: "ALL_NEW",
    });
  });

  it("returns null instead of creating a partial item when nothing exists", async () => {
    send.mockRejectedValue(conditionFailed());
    const { updateItem, sk } = await import("../db");

    await expect(
      updateItem("s1", sk.encounter("missing"), { text: "x" }, noteSchema),
    ).resolves.toBeNull();
  });

  it.each(["PK", "SK"])("refuses to change the key attribute %s", async (key) => {
    const { updateItem, sk } = await import("../db");

    await expect(
      updateItem("s1", sk.encounter("e1"), { [key]: "SESSION#other" }, noteSchema),
    ).rejects.toThrow("Cannot update key attribute");
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses an empty update", async () => {
    const { updateItem, sk } = await import("../db");

    await expect(updateItem("s1", sk.encounter("e1"), {}, noteSchema)).rejects.toThrow(
      "No fields to update",
    );
  });
});

describe("appendUniqueToList", () => {
  it("appends atomically and reports true", async () => {
    send.mockResolvedValue({});
    const { appendUniqueToList, sk } = await import("../db");

    await expect(
      appendUniqueToList("s1", sk.encounter("e1"), "unlockedTherapyIds", "therapy-brand"),
    ).resolves.toBe(true);
    expect(sentInput()).toEqual({
      TableName: "test-table",
      Key: { PK: "SESSION#s1", SK: "ENC#e1" },
      UpdateExpression: "SET #list = list_append(#list, :items)",
      ConditionExpression: "attribute_exists(PK) AND NOT contains(#list, :value)",
      ExpressionAttributeNames: { "#list": "unlockedTherapyIds" },
      ExpressionAttributeValues: { ":items": ["therapy-brand"], ":value": "therapy-brand" },
    });
  });

  it("reports false when the value is already present or the item is missing", async () => {
    send.mockRejectedValue(conditionFailed());
    const { appendUniqueToList, sk } = await import("../db");

    await expect(
      appendUniqueToList("s1", sk.encounter("e1"), "unlockedTherapyIds", "therapy-brand"),
    ).resolves.toBe(false);
  });
});

describe("deleteItem", () => {
  it("deletes only within the session partition", async () => {
    send.mockResolvedValue({});
    const { deleteItem, sk } = await import("../db");

    await deleteItem("s1", sk.cache("h1"));

    expect(sentInput()).toEqual({
      TableName: "test-table",
      Key: { PK: "SESSION#s1", SK: "CACHE#h1" },
    });
  });
});
