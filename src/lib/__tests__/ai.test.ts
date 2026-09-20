// @vitest-environment node
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APICallError } from "ai";
import type { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

const { doGenerate, send, configuration, attemptedKeys } = vi.hoisted(() => ({
  doGenerate: vi.fn<MockLanguageModelV4["doGenerate"]>(),
  send: vi.fn(),
  attemptedKeys: [] as string[],
  configuration: {
    GOOGLE_GENERATIVE_AI_API_KEY: "test-key",
    GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK: undefined as string | undefined,
    GEMINI_MODEL: "test-model",
    AWS_REGION: "us-east-1",
    AWS_ACCESS_KEY_ID: "test-access-key",
    AWS_SECRET_ACCESS_KEY: "test-secret-key",
    DDB_TABLE: "test-table",
  },
}));

vi.mock("@/lib/env", () => ({ env: configuration }));
vi.mock("@ai-sdk/google", async () => {
  const { MockLanguageModelV4 } = await import("ai/test");
  return {
    createGoogle: ({ apiKey }: { apiKey: string }) => (modelId: string) => new MockLanguageModelV4({
      modelId,
      doGenerate: (options) => {
        attemptedKeys.push(apiKey);
        return doGenerate(options);
      },
    }),
  };
});
vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>()),
  DynamoDBDocumentClient: { from: () => ({ send }) },
}));

import { generateStructured } from "@/lib/ai";

const options = {
  sessionId: "synthetic-session-a",
  schema: z.object({ note: z.string(), unknown: z.null() }),
  system: "Return the synthetic note. Preserve unknown information.",
  prompt: "Synthetic example",
  promptVersion: "test-v1",
};
const data = { note: "Synthetic example", unknown: null };
const NOW = new Date("2026-09-19T12:00:00.000Z");
const records = new Map<string, Record<string, unknown>>();

function response(text = JSON.stringify(data)): Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>> {
  return {
    content: [{ type: "text", text }],
    finishReason: { unified: "stop", raw: "STOP" },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  };
}

function apiError(statusCode?: number) {
  return new APICallError({
    message: "Synthetic provider failure",
    url: "https://example.invalid/generate",
    requestBodyValues: {},
    statusCode,
    ...(statusCode === undefined ? { isRetryable: true } : {}),
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", undefined);
  configuration.GEMINI_MODEL = "test-model";
  configuration.GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK = undefined;
  attemptedKeys.length = 0;
  doGenerate.mockReset().mockResolvedValue(response());
  records.clear();
  send.mockReset().mockImplementation(async (command: GetCommand | PutCommand) => {
    if (command instanceof GetCommand) {
      return { Item: records.get(JSON.stringify(command.input.Key)) };
    }
    if (command instanceof PutCommand) {
      const item = command.input.Item!;
      records.set(JSON.stringify({ PK: item.PK, SK: item.SK }), item);
      return {};
    }
    throw new Error("Unexpected database command");
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("generateStructured", () => {
  it("switches to the fallback key after a 429 and caches the validated result", async () => {
    configuration.GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK = "test-fallback-key";
    doGenerate.mockRejectedValueOnce(apiError(429));
    const result = generateStructured(options);
    await vi.advanceTimersByTimeAsync(500);
    expect(await result).toEqual({ ok: true, data, cached: false });
    expect(attemptedKeys).toEqual(["test-key", "test-fallback-key"]);
    expect(await generateStructured(options)).toEqual({ ok: true, data, cached: true });
    expect(doGenerate).toHaveBeenCalledTimes(2);
  });

  it("keeps the three-attempt bound when both keys are rate-limited", async () => {
    configuration.GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK = "test-fallback-key";
    doGenerate.mockRejectedValue(apiError(429));
    const result = generateStructured(options);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(await result).toEqual({ ok: false, reason: "rate_limited" });
    expect(attemptedKeys).toEqual(["test-key", "test-fallback-key", "test-fallback-key"]);
    expect(records.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries an overloaded provider on the same key", async () => {
    configuration.GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK = "test-fallback-key";
    doGenerate.mockRejectedValueOnce(apiError(503));
    const result = generateStructured(options);
    await vi.advanceTimersByTimeAsync(500);
    expect(await result).toEqual({ ok: true, data, cached: false });
    expect(attemptedKeys).toEqual(["test-key", "test-key"]);
  });

  it.each([400, 401, 403, 404])("does not switch credentials for permanent status %s", async (status) => {
    configuration.GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK = "test-fallback-key";
    doGenerate.mockRejectedValue(apiError(status));
    expect(await generateStructured(options)).toEqual({ ok: false, reason: "provider_error" });
    expect(attemptedKeys).toEqual(["test-key"]);
  });

  it("validates model JSON through the real SDK and caches it in the session partition", async () => {
    expect(await generateStructured(options)).toEqual({ ok: true, data, cached: false });
    expect(doGenerate).toHaveBeenCalledTimes(1);
    expect(doGenerate.mock.calls[0][0].responseFormat).toMatchObject({
      type: "json",
      schema: { type: "object", required: ["note", "unknown"] },
    });
    expect([...records.values()]).toEqual([{
      PK: "SESSION#synthetic-session-a",
      SK: expect.stringMatching(/^CACHE#[a-f0-9]{64}$/),
      data,
      ttl: NOW.getTime() / 1000 + 24 * 60 * 60,
    }]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['{"note":42,"unknown":null}', '{"note":"missing unknown"}', "not JSON", ""])(
    "returns a typed failure for invalid output %j without retrying or caching it",
    async (text) => {
      doGenerate.mockResolvedValue(response(text));
      expect(await generateStructured(options)).toEqual({ ok: false, reason: "invalid_output" });
      expect(doGenerate).toHaveBeenCalledTimes(1);
      expect(records.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("aborts each timed-out request and stops after the initial attempt plus two retries", async () => {
    // A stalled model ignores abort; the helper still has to settle on time.
    doGenerate.mockImplementation(() => new Promise(() => {}));
    const result = generateStructured(options);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(await result).toEqual({ ok: false, reason: "timeout" });
    expect(doGenerate).toHaveBeenCalledTimes(3);
    expect(doGenerate.mock.calls.every(([call]) => call.abortSignal?.aborted)).toBe(true);
    expect(new Set(doGenerate.mock.calls.map(([call]) => call.abortSignal)).size).toBe(3);
    expect(records.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("can succeed with a fresh request after a timeout", async () => {
    doGenerate.mockImplementationOnce(() => new Promise(() => {}));
    const result = generateStructured(options);
    await vi.advanceTimersByTimeAsync(12_500);
    expect(await result).toEqual({ ok: true, data, cached: false });
    expect(doGenerate).toHaveBeenCalledTimes(2);
    expect(doGenerate.mock.calls[1][0].abortSignal?.aborted).toBe(false);
  });

  it("also retries and labels timeouts reported by the provider", async () => {
    doGenerate.mockRejectedValue(new DOMException("Synthetic timeout", "TimeoutError"));
    const result = generateStructured(options);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(await result).toEqual({ ok: false, reason: "timeout" });
    expect(doGenerate).toHaveBeenCalledTimes(3);
    expect(records.size).toBe(0);
  });

  it.each([429, 503, undefined])("retries transient status %s and can succeed on the third attempt", async (status) => {
    doGenerate.mockRejectedValueOnce(apiError(status)).mockRejectedValueOnce(apiError(status));
    const result = generateStructured(options);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(await result).toEqual({ ok: true, data, cached: false });
    expect(doGenerate).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    [429, "rate_limited"],
    [503, "provider_error"],
  ] as const)("classifies exhausted status %s without nested SDK retries or provider details", async (status, reason) => {
    doGenerate.mockRejectedValue(apiError(status));
    const result = generateStructured(options);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(await result).toEqual({ ok: false, reason });
    expect(doGenerate).toHaveBeenCalledTimes(3);
    expect(records.size).toBe(0);
  });

  it.each([400, 401, 403, 404])("does not retry permanent status %s", async (status) => {
    doGenerate.mockRejectedValue(apiError(status));
    expect(await generateStructured(options)).toEqual({ ok: false, reason: "provider_error" });
    expect(doGenerate).toHaveBeenCalledTimes(1);
    expect(records.size).toBe(0);
  });

  it("does not leak unexpected provider errors to callers", async () => {
    doGenerate.mockRejectedValue(new Error("Synthetic private provider details"));
    expect(await generateStructured(options)).toEqual({ ok: false, reason: "provider_error" });
    expect(doGenerate).toHaveBeenCalledTimes(1);
  });

  it("serves the same normalized input from cache without another model call", async () => {
    await generateStructured(options);
    expect(await generateStructured({
      ...options,
      system: `  ${options.system.replaceAll(" ", "\n\t")}  `,
      prompt: " \nSynthetic   example\t",
    })).toEqual({ ok: true, data, cached: true });
    expect(doGenerate).toHaveBeenCalledTimes(1);
  });

  it.each(["sessionId", "system", "prompt", "promptVersion", "model"] as const)(
    "does not reuse output when %s changes",
    async (field) => {
      await generateStructured(options);
      const changed = { ...options };
      if (field === "model") configuration.GEMINI_MODEL = "other-test-model";
      else changed[field] += "-changed";
      expect(await generateStructured(changed)).toEqual({ ok: true, data, cached: false });
      expect(doGenerate).toHaveBeenCalledTimes(2);
      expect(records.size).toBe(2);
    },
  );

  it("revalidates cached data against the caller's schema", async () => {
    await generateStructured(options);
    expect(await generateStructured({ ...options, schema: z.object({ note: z.number() }) }))
      .toEqual({ ok: false, reason: "invalid_output" });
    expect(doGenerate).toHaveBeenCalledTimes(1);
  });

  it("applies Zod transforms once for both live and cached output", async () => {
    const transformed = { ...options, schema: z.object({ note: z.string().transform((value) => value.length) }) };
    expect(await generateStructured(transformed)).toEqual({
      ok: true, data: { note: data.note.length }, cached: false,
    });
    expect(await generateStructured(transformed)).toEqual({
      ok: true, data: { note: data.note.length }, cached: true,
    });
    expect(doGenerate).toHaveBeenCalledTimes(1);
  });

  it("ignores expired cache entries before DynamoDB deletes them", async () => {
    await generateStructured(options);
    vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * 60 * 1000));
    expect(await generateStructured(options)).toEqual({ ok: true, data, cached: false });
    expect(doGenerate).toHaveBeenCalledTimes(2);
  });

  it("reports a cache read failure without calling the model", async () => {
    send.mockRejectedValueOnce(new Error("Synthetic database failure"));
    expect(await generateStructured(options)).toEqual({ ok: false, reason: "cache_error" });
    expect(doGenerate).not.toHaveBeenCalled();
  });

  it("reports a cache write failure without retrying generation", async () => {
    send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Synthetic database failure"));
    expect(await generateStructured(options)).toEqual({ ok: false, reason: "cache_error" });
    expect(doGenerate).toHaveBeenCalledTimes(1);
  });
});
