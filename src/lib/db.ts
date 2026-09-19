import "server-only";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { env } from "./env";

/**
 * Single-table DynamoDB access (sickway.md §4, §8).
 *
 * Every helper takes a demo session ID and only touches that session's
 * partition. There is deliberately no way to read an encounter or packet by ID
 * alone, and no Scan: the IAM policy does not allow it.
 *
 * Table attributes are exactly `PK`, `SK`, and `ttl`, matching the table in AWS.
 */

/** Old sessions expire on their own; they are never reused in judging. */
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

export function ttlFromNow(seconds: number = SESSION_TTL_SECONDS): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

// A "#" inside an id could make one session's key collide with another's.
function segment(value: string): string {
  if (value.trim() === "" || value.includes("#")) {
    throw new Error("Invalid key segment");
  }
  return value;
}

export const SK_PREFIX = {
  encounter: "ENC#",
  packet: "PKT#",
  event: "EVT#",
  cache: "CACHE#",
} as const;

export function pk(demoSessionId: string): string {
  return `SESSION#${segment(demoSessionId)}`;
}

export const sk = {
  meta: () => "META",
  encounter: (encounterId: string) => `${SK_PREFIX.encounter}${segment(encounterId)}`,
  packet: (packetId: string) => `${SK_PREFIX.packet}${segment(packetId)}`,
  /** Timestamp first so a session's events sort chronologically. */
  event: (timestamp: string, eventId: string) =>
    `${SK_PREFIX.event}${segment(timestamp)}#${segment(eventId)}`,
  cache: (hash: string) => `${SK_PREFIX.cache}${segment(hash)}`,
};

let client: DynamoDBDocumentClient | undefined;

function db(): DynamoDBDocumentClient {
  client ??= DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  return client;
}

type Fields = Record<string, unknown>;

function toItem(demoSessionId: string, sortKey: string, record: Fields): Fields {
  return {
    ...record,
    PK: pk(demoSessionId),
    SK: sortKey,
    ttl: typeof record.ttl === "number" ? record.ttl : ttlFromNow(),
  };
}

function fromItem<T>(item: Fields, schema: z.ZodType<T>): T {
  const record = { ...item };
  delete record.PK;
  delete record.SK;
  return schema.parse(record);
}

/** Creates or replaces an item in the session partition. */
export async function putItem(
  demoSessionId: string,
  sortKey: string,
  record: Fields,
): Promise<void> {
  await db().send(
    new PutCommand({
      TableName: env.DDB_TABLE,
      Item: toItem(demoSessionId, sortKey, record),
    }),
  );
}

/**
 * Creates an item only when none exists at that key.
 * Returns false, without overwriting, when it already exists.
 */
export async function putItemIfAbsent(
  demoSessionId: string,
  sortKey: string,
  record: Fields,
): Promise<boolean> {
  try {
    await db().send(
      new PutCommand({
        TableName: env.DDB_TABLE,
        Item: toItem(demoSessionId, sortKey, record),
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

/** Returns null when the item does not exist in this session. */
export async function getItem<T>(
  demoSessionId: string,
  sortKey: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const { Item } = await db().send(
    new GetCommand({
      TableName: env.DDB_TABLE,
      Key: { PK: pk(demoSessionId), SK: sortKey },
      // Two devices poll the same record; a read must see the other's write.
      ConsistentRead: true,
    }),
  );
  return Item ? fromItem(Item, schema) : null;
}

/** Lists the session's items whose sort key starts with `prefix` (see SK_PREFIX). */
export async function queryByPrefix<T>(
  demoSessionId: string,
  prefix: string,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const items: T[] = [];
  let startKey: Fields | undefined;
  do {
    const page = await db().send(
      new QueryCommand({
        TableName: env.DDB_TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: { ":pk": pk(demoSessionId), ":prefix": prefix },
        ConsistentRead: true,
        ExclusiveStartKey: startKey,
      }),
    );
    for (const item of page.Items ?? []) items.push(fromItem(item, schema));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return items;
}

/**
 * Sets top-level fields on an existing item and returns the updated record.
 * Returns null, without creating a partial item, when nothing exists at that key.
 */
export async function updateItem<T>(
  demoSessionId: string,
  sortKey: string,
  fields: Fields,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const entries = Object.entries(fields);
  if (entries.length === 0) throw new Error("No fields to update");
  for (const [name] of entries) {
    if (name === "PK" || name === "SK") throw new Error("Cannot update key attribute");
  }

  try {
    const { Attributes } = await db().send(
      new UpdateCommand({
        TableName: env.DDB_TABLE,
        Key: { PK: pk(demoSessionId), SK: sortKey },
        UpdateExpression: `SET ${entries.map((_, i) => `#f${i} = :v${i}`).join(", ")}`,
        ExpressionAttributeNames: Object.fromEntries(
          entries.map(([name], i) => [`#f${i}`, name]),
        ),
        ExpressionAttributeValues: Object.fromEntries(
          entries.map(([, value], i) => [`:v${i}`, value]),
        ),
        ConditionExpression: "attribute_exists(PK)",
        ReturnValues: "ALL_NEW",
      }),
    );
    return Attributes ? fromItem(Attributes, schema) : null;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return null;
    throw error;
  }
}

/**
 * Atomically appends `value` to a list attribute unless it is already there, so
 * concurrent writers cannot drop each other's entries (§7.4 resource unlocks).
 * Returns false when the value was already present or the item does not exist.
 */
export async function appendUniqueToList(
  demoSessionId: string,
  sortKey: string,
  attribute: string,
  value: string,
): Promise<boolean> {
  try {
    await db().send(
      new UpdateCommand({
        TableName: env.DDB_TABLE,
        Key: { PK: pk(demoSessionId), SK: sortKey },
        UpdateExpression: "SET #list = list_append(#list, :items)",
        ConditionExpression: "attribute_exists(PK) AND NOT contains(#list, :value)",
        ExpressionAttributeNames: { "#list": attribute },
        ExpressionAttributeValues: { ":items": [value], ":value": value },
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

export async function deleteItem(demoSessionId: string, sortKey: string): Promise<void> {
  await db().send(
    new DeleteCommand({
      TableName: env.DDB_TABLE,
      Key: { PK: pk(demoSessionId), SK: sortKey },
    }),
  );
}
