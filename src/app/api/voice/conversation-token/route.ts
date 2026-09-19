import { errorJson, json } from "@/lib/http";
import { requireSession } from "@/lib/session";
import { mintConversationToken, voiceAvailability } from "@/lib/voice-server";

/** A short-lived token for the clinician voice agent. Paired demo sessions only, live mode only. */
export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!voiceAvailability().clinicianAgent) return errorJson(404, "voice_not_enabled");

  const token = await mintConversationToken();
  return token ? json({ token }) : errorJson(503, "voice_unavailable");
}
