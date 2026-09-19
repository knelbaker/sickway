// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

const { configuration, getItem, doGenerate } = vi.hoisted(() => ({
  configuration: { GOOGLE_GENERATIVE_AI_API_KEY: "k", GEMINI_MODEL: "m", DEMO_SIMULATE_AI_FAILURE: undefined as string | undefined },
  getItem: vi.fn(),
  doGenerate: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: configuration }));
vi.mock("@/lib/db", () => ({ getItem, putItem: vi.fn(), sk: { cache: (hash: string) => `CACHE#${hash}` } }));
vi.mock("@ai-sdk/google", async () => {
  const { MockLanguageModelV4 } = await import("ai/test");
  return { createGoogle: () => (modelId: string) => new MockLanguageModelV4({ modelId, doGenerate }) };
});

import { aiFailureSimulated, generateStructured } from "@/lib/ai";

const options = { sessionId: "s1", schema: z.object({ ok: z.boolean() }), system: "s", prompt: "p", promptVersion: "v" };

afterEach(() => {
  configuration.DEMO_SIMULATE_AI_FAILURE = undefined;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("rehearsal failure switch", () => {
  it("is off unless the flag is exactly 1", () => {
    for (const value of [undefined, "", "0", "true", "yes"]) {
      configuration.DEMO_SIMULATE_AI_FAILURE = value;
      expect(aiFailureSimulated()).toBe(false);
    }
  });

  it("fails generation immediately, without reading the cache or calling the model", async () => {
    configuration.DEMO_SIMULATE_AI_FAILURE = "1";

    await expect(generateStructured(options)).resolves.toEqual({ ok: false, reason: "provider_error" });
    expect(getItem).not.toHaveBeenCalled();
    expect(doGenerate).not.toHaveBeenCalled();
  });

  it("is ignored on a production deployment, so it cannot fire during judging", async () => {
    configuration.DEMO_SIMULATE_AI_FAILURE = "1";
    vi.stubEnv("VERCEL_ENV", "production");
    getItem.mockResolvedValue(null);
    doGenerate.mockRejectedValue(new Error("reached the model"));

    expect(aiFailureSimulated()).toBe(false);
    await generateStructured(options);
    expect(getItem).toHaveBeenCalled();
  });
});
