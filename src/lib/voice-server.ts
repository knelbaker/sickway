import "server-only";
import { env } from "@/lib/env";

/**
 * Optional ElevenLabs voice (sickway.md §6.2). Voice is only an input layer over
 * the typed flow. The API key never leaves the server: browsers receive
 * short-lived, single-purpose tokens, and only a paired demo session can ask
 * for one, so the agent ID alone cannot be used to spend credits.
 */

const API = "https://api.elevenlabs.io/v1";
const TIMEOUT_MS = 8000;

/** Live voice needs VOICE_MODE=live and a key; the clinician agent also needs its ID. */
export function voiceAvailability() {
  const live = env.VOICE_MODE === "live" && Boolean(env.ELEVENLABS_API_KEY);
  return {
    clinicianAgent: live && Boolean(env.NEXT_PUBLIC_DOORWAY_AGENT_ID),
    studentDictation: live,
  };
}

async function elevenLabs(path: string, method: "GET" | "POST"): Promise<string | null> {
  try {
    const response = await fetch(API + path, {
      method,
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY ?? "" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { token?: unknown };
    return typeof body.token === "string" && body.token ? body.token : null;
  } catch {
    // Provider errors can carry request details; callers report a generic failure.
    return null;
  }
}

/** WebRTC conversation token for the private clinician agent. */
export function mintConversationToken(): Promise<string | null> {
  const agentId = encodeURIComponent(env.NEXT_PUBLIC_DOORWAY_AGENT_ID ?? "");
  return elevenLabs(`/convai/conversation/token?agent_id=${agentId}`, "GET");
}

/** Single-use token for realtime speech-to-text (student dictation). */
export function mintScribeToken(): Promise<string | null> {
  return elevenLabs("/single-use-token/realtime_scribe", "POST");
}
