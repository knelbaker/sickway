"use client";

import { CommitStrategy, useScribe } from "@elevenlabs/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import MatrixOrb from "@/components/ui/matrix-orb";
import { useLanguage } from "@/lib/client/language-store";
import { apiFetch } from "@/lib/client/session-store";

/**
 * Optional dictation for the opening description (rendered only when
 * VOICE_MODE=live). It is speech-to-text and nothing more: what it hears is put
 * into the same text box for the student to read and edit. There is no agent,
 * and it has no way to answer follow-ups, confirm onset, give consent, or submit
 * (sickway.md §6.1: no voice agent can supply consent).
 */
export function VoiceInput({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const { language, t } = useLanguage();
  const d = t.dictation;
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    // The server commits a segment at each natural pause.
    commitStrategy: CommitStrategy.VAD,
    // Listen in the language the student chose for the screen; nothing is translated.
    languageCode: language,
    onCommittedTranscript: ({ text }) => {
      if (text.trim()) onTranscript(text.trim());
    },
    onError: () => setNotice(`${d.stopped} ${d.fallback}`),
  });

  // Never leave the microphone open after this step is gone.
  const disconnect = scribe.disconnect;
  useEffect(() => () => disconnect(), [disconnect]);

  async function start() {
    setNotice(null);
    setStarting(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setNotice(`${d.micDenied} ${d.fallback}`);
        return;
      }
      // Only the permission was needed; the SDK opens its own stream.
      stream.getTracks().forEach((track) => track.stop());

      const response = await apiFetch("/api/voice/scribe-token", { method: "POST" });
      if (!response.ok) {
        setNotice(`${d.unavailable} ${d.fallback}`);
        return;
      }
      const { token } = (await response.json()) as { token: string };
      await scribe.connect({ token, microphone: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setNotice(`${d.failed} ${d.fallback}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {scribe.isConnected ? (
          <Button type="button" variant="outline" className="h-11" onClick={() => scribe.disconnect()}>
            {d.stop}
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-11" disabled={disabled || starting} onClick={() => void start()}>
            {starting ? d.starting : d.start}
          </Button>
        )}
        <MatrixOrb
          state={scribe.isConnected ? "listening" : starting ? "thinking" : "idle"}
          labels={{ idle: d.off, listening: d.listening, thinking: d.starting }}
          size={40}
          color="#c8121b"
          className="flex-row gap-2"
        />
      </div>
      {scribe.isConnected && (
        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {scribe.partialTranscript ? d.hearing(scribe.partialTranscript) : d.speakNow}
        </p>
      )}
      {notice && (
        <p role="alert" className="text-sm">
          {notice}
        </p>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        {d.note}
      </p>
    </div>
  );
}
