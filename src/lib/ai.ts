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
const cacheSchema = z.object({ data: z.unknown(), ttl: z.number() });

export type StructuredResult<T> =
  | { ok: true; data: T; cached: boolean }
  | {
      ok: false;
      reason: "timeout" | "invalid_output" | "rate_limited" | "provider_error" | "cache_error";
    };

/**
 * Rehearsal switch (sickway.md §15): DEMO_SIMULATE_AI_FAILURE=1 makes every
 * generation fail so the labelled fallbacks can be practised. It is ignored on
 * production deployments, so it cannot be triggered during judging.
 */
export function aiFailureSimulated(): boolean {
  return env.DEMO_SIMULATE_AI_FAILURE === "1" && process.env.VERCEL_ENV !== "production";
}

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
  if (aiFailureSimulated()) return { ok: false, reason: "provider_error" };

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

  const apiKeys = [...new Set([
    env.GOOGLE_GENERATIVE_AI_API_KEY,
    ...(env.GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK ? [env.GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK] : []),
  ])];
  const providers = apiKeys.map((apiKey) => createGoogle({ apiKey }));
  let providerIndex = 0;

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
          model: providers[providerIndex](env.GEMINI_MODEL),
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
      const rateLimited = APICallError.isInstance(error) && error.statusCode === 429;
      if (!retryable || attempt >= MAX_RETRIES) {
        // Preserve quota/rate-limit failures without exposing provider request details.
        return { ok: false, reason: timedOut ? "timeout" : rateLimited ? "rate_limited" : "provider_error" };
      }
      // Switching credentials consumes the same retry budget. Never return to
      // a key that was already rate-limited during this request.
      if (rateLimited) providerIndex = Math.min(providerIndex + 1, providers.length - 1);
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
