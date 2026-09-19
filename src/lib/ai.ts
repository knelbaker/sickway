import "server-only";
import { createHash } from "node:crypto";
import { createGoogle } from "@ai-sdk/google";
import {
  APICallError,
  generateText,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
} from "ai";
import { z } from "zod";
import { getItem, putItem, sk } from "@/lib/db";
import { env } from "@/lib/env";

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;
const google = createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
const cacheSchema = z.object({ data: z.unknown(), ttl: z.number() });

export type StructuredResult<T> =
  | { ok: true; data: T; cached: boolean }
  | {
      ok: false;
      reason: "timeout" | "invalid_output" | "provider_error" | "cache_error";
    };

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Callers must supply the session ID verified by their server-side session check. */
export async function generateStructured<T>({
  sessionId,
  schema,
  system,
  prompt,
  promptVersion,
}: {
  sessionId: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  promptVersion: string;
}): Promise<StructuredResult<T>> {
  const key = sk.cache(
    createHash("sha256")
      .update(JSON.stringify({
        system: normalize(system),
        prompt: normalize(prompt),
        model: env.GEMINI_MODEL,
        promptVersion,
      }))
      .digest("hex"),
  );

  let cached;
  try {
    cached = await getItem(sessionId, key, cacheSchema);
  } catch {
    return { ok: false, reason: "cache_error" };
  }

  // DynamoDB TTL deletion is asynchronous; never serve expired records.
  if (cached && cached.ttl > Math.floor(Date.now() / 1000)) {
    const parsed = await schema.safeParseAsync(cached.data);
    return parsed.success
      ? { ok: true, data: parsed.data, cached: true }
      : { ok: false, reason: "invalid_output" };
  }

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generated: { output: T; text: string } | undefined;

    try {
      // Abort the HTTP request and bound the wait even if a provider ignores abort.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new DOMException("Generation timed out", "TimeoutError");
          controller.abort(error);
          reject(error);
        }, REQUEST_TIMEOUT_MS);
      });
      const result = await Promise.race([
        generateText({
          model: google(env.GEMINI_MODEL),
          output: Output.object({ schema }),
          system,
          prompt,
          abortSignal: controller.signal,
          // This module owns retries, including timeouts; avoid nested retries.
          maxRetries: 0,
        }),
        timeout,
      ]);
      // Accessing output also rejects empty/blocked responses via the SDK.
      generated = { output: result.output, text: result.text };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
        return { ok: false, reason: "invalid_output" };
      }

      const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "TimeoutError");
      const retryable = timedOut || (APICallError.isInstance(error) && error.isRetryable);
      if (!retryable || attempt >= MAX_RETRIES) {
        return { ok: false, reason: timedOut ? "timeout" : "provider_error" };
      }
    } finally {
      clearTimeout(timer);
    }

    if (generated) {
      try {
        // Store pre-transform JSON so Zod transforms run once on cache hits too.
        await putItem(sessionId, key, { data: JSON.parse(generated.text) });
      } catch {
        return { ok: false, reason: "cache_error" };
      }
      return { ok: true, data: generated.output, cached: false };
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
}
