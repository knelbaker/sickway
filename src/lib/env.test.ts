// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Next.js enforces this boundary; unit tests run outside its server runtime.
vi.mock("server-only", () => ({}));

const requiredVariables = {
  GOOGLE_GENERATIVE_AI_API_KEY: "test-google-key",
  GEMINI_MODEL: "test-model",
  AWS_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key",
  DDB_TABLE: "test-table",
  DEMO_SESSION_SECRET: "test-session-secret",
};

const optionalVariables = [
  "GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK",
  "ELEVENLABS_API_KEY",
  "NEXT_PUBLIC_DOORWAY_AGENT_ID",
  "NEXT_PUBLIC_INTAKE_AGENT_ID",
] as const;

beforeEach(() => {
  vi.resetModules();
  for (const [name, value] of Object.entries(requiredVariables)) {
    vi.stubEnv(name, value);
  }
  for (const name of optionalVariables) {
    vi.stubEnv(name, undefined);
  }
  vi.stubEnv("VOICE_MODE", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server environment", () => {
  it("loads required configuration and defaults to baseline voice", async () => {
    const { env } = await import("./env");

    expect(env).toMatchObject({ ...requiredVariables, VOICE_MODE: "baseline" });
    for (const name of optionalVariables) {
      expect(env[name]).toBeUndefined();
    }
  });

  it.each(Object.keys(requiredVariables))(
    "rejects missing or blank %s on import without exposing values",
    async (name) => {
      for (const value of [undefined, "", "   "]) {
        vi.resetModules();
        vi.stubEnv(name, value);

        await expect(import("./env")).rejects.toThrow(
          new Error(`Missing or invalid environment variables: ${name}`),
        );
      }
    },
  );

  it.each(["", "   "])("accepts blank optional values (%j)", async (value) => {
    vi.stubEnv("VOICE_MODE", value);
    for (const name of optionalVariables) {
      vi.stubEnv(name, value);
    }

    const { env } = await import("./env");

    expect(env.VOICE_MODE).toBe("baseline");
    for (const name of optionalVariables) {
      expect(env[name]).toBeUndefined();
    }
  });

  it("accepts live voice and configured optional values", async () => {
    vi.stubEnv("VOICE_MODE", "live");
    for (const name of optionalVariables) {
      vi.stubEnv(name, "test-optional-value");
    }

    const { env } = await import("./env");

    expect(env.VOICE_MODE).toBe("live");
    for (const name of optionalVariables) {
      expect(env[name]).toBe("test-optional-value");
    }
  });

  it("reports all invalid names without logging or leaking values", async () => {
    vi.stubEnv("DDB_TABLE", undefined);
    vi.stubEnv("VOICE_MODE", "private-invalid-value");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(import("./env")).rejects.toThrow(
        new Error("Missing or invalid environment variables: DDB_TABLE, VOICE_MODE"),
      );
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
