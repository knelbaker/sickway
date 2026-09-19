import type { z } from "zod";

/**
 * In-memory stand-in for `@/lib/db` with the same session-partitioned semantics,
 * for route tests:
 *
 *   const fake = vi.hoisted(() => ({ db: undefined as unknown as FakeDb }));
 *   vi.mock("@/lib/db", async () => (fake.db = (await import("…/fake-db")).createFakeDb()));
 */
type Fields = Record<string, unknown>;

export function createFakeDb() {
  const items = new Map<string, Fields>();
  const at = (sessionId: string, sortKey: string) => `${sessionId}|${sortKey}`;
  const strip = <T>(item: Fields, schema: z.ZodType<T>) => schema.parse(structuredClone(item));

  return {
    items,
    SESSION_TTL_SECONDS: 24 * 60 * 60,
    SK_PREFIX: { encounter: "ENC#", packet: "PKT#", event: "EVT#", cache: "CACHE#" },
    pk: (sessionId: string) => `SESSION#${sessionId}`,
    sk: {
      meta: () => "META",
      encounter: (id: string) => `ENC#${id}`,
      packet: (id: string) => `PKT#${id}`,
      event: (timestamp: string, id: string) => `EVT#${timestamp}#${id}`,
      cache: (hash: string) => `CACHE#${hash}`,
    },
    ttlFromNow: (seconds = 24 * 60 * 60) => Math.floor(Date.now() / 1000) + seconds,

    async putItem(sessionId: string, sortKey: string, record: Fields) {
      items.set(at(sessionId, sortKey), structuredClone(record));
    },
    async putItemIfAbsent(sessionId: string, sortKey: string, record: Fields) {
      if (items.has(at(sessionId, sortKey))) return false;
      items.set(at(sessionId, sortKey), structuredClone(record));
      return true;
    },
    async getItem<T>(sessionId: string, sortKey: string, schema: z.ZodType<T>) {
      const item = items.get(at(sessionId, sortKey));
      return item ? strip(item, schema) : null;
    },
    async queryByPrefix<T>(sessionId: string, prefix: string, schema: z.ZodType<T>) {
      return [...items.entries()]
        .filter(([key]) => key.startsWith(`${sessionId}|${prefix}`))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, item]) => strip(item, schema));
    },
    async updateItem<T>(sessionId: string, sortKey: string, fields: Fields, schema: z.ZodType<T>) {
      const item = items.get(at(sessionId, sortKey));
      if (!item) return null;
      Object.assign(item, structuredClone(fields));
      return strip(item, schema);
    },
    async appendUniqueToList(sessionId: string, sortKey: string, attribute: string, value: string) {
      const item = items.get(at(sessionId, sortKey));
      const list = item?.[attribute];
      if (!item || !Array.isArray(list) || list.includes(value)) return false;
      list.push(value);
      return true;
    },
    async deleteItem(sessionId: string, sortKey: string) {
      items.delete(at(sessionId, sortKey));
    },
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;
