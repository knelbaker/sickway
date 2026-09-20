/**
 * Brief audio rules (sickway.md §6.4). Browser-safe.
 *
 * The prerecorded file is `public/demo-brief.mp3`, rendered from the exact
 * `spokenScript` in `data/demo-brief.json`. It may be played only when the
 * brief on screen says the same thing; other briefs use the same ElevenLabs
 * voice and model on demand, or show an explicit audio-unavailable state.
 */

export const PREPARED_BRIEF_AUDIO_SRC = "/demo-brief.mp3";

export type BriefAudioMode = "prepared_recording" | "elevenlabs" | "unavailable";

export const BRIEF_AUDIO_LABEL: Record<BriefAudioMode, string> = {
  prepared_recording: "Prepared recording",
  elevenlabs: "ElevenLabs audio",
  unavailable: "Audio unavailable — read the brief below",
};

/** Case, punctuation, and spacing do not change what is said; the words must be identical. */
export function normalizeScript(script: string): string {
  return script
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9°\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compares what would be spoken, never encounter IDs or the brief's source label. */
export function matchesPreparedScript(script: string, preparedScript: string): boolean {
  const normalized = normalizeScript(script);
  return normalized !== "" && normalized === normalizeScript(preparedScript);
}
