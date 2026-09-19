import { errorJson, json } from "@/lib/http";
import { requireSession } from "@/lib/session";
import { mintScribeToken, voiceAvailability } from "@/lib/voice-server";

/** A single-use speech-to-text token for student dictation. Paired demo sessions only, live mode only. */
export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!voiceAvailability().studentDictation) return errorJson(404, "voice_not_enabled");

  const token = await mintScribeToken();
  return token ? json({ token }) : errorJson(503, "voice_unavailable");
}
