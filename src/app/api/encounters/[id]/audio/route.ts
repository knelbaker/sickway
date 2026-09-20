import { z } from "zod";
import voice from "../../../../../../data/demo-voice.json";
import { getEncounter } from "@/lib/encounters";
import { env } from "@/lib/env";
import { errorJson } from "@/lib/http";
import { requireSession } from "@/lib/session";

const requestSchema = z.object({ spokenScript: z.string().min(1) });

/** Generate only the caller's saved, consented brief, in either voice mode. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return errorJson(400, "invalid_request");

  const { id } = await params;
  try {
    const encounter = await getEncounter(auth.session.id, id);
    if (!encounter) return errorJson(404, "encounter_not_found");
    if (!encounter.consent.shareWithClinic) return errorJson(403, "consent_required");
    const script = encounter.sbar?.spokenScript;
    if (!script?.trim()) return errorJson(503, "audio_unavailable");
    if (body.data.spokenScript !== script) return errorJson(409, "brief_changed");
    if (!env.ELEVENLABS_API_KEY) return errorJson(503, "audio_unavailable");

    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
    signal.throwIfAborted();
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=${voice.outputFormat}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({ text: script, model_id: voice.modelId }),
        signal,
        cache: "no-store",
      },
    );
    if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/mpeg")) {
      await response.body?.cancel();
      return errorJson(503, "audio_unavailable");
    }
    const audio = await response.arrayBuffer();
    signal.throwIfAborted();
    if (!audio.byteLength) return errorJson(503, "audio_unavailable");
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    // Provider errors may contain request details; never return or log them.
    return errorJson(503, "audio_unavailable");
  }
}
