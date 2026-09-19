"use client";

import { CommitStrategy, useScribe } from "@elevenlabs/react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/session-store";

const FALLBACK = "Typing works exactly the same.";

/**
 * Optional dictation for the opening description (rendered only when
 * VOICE_MODE=live). It is speech-to-text and nothing more: what it hears is put
 * into the same text box for the student to read and edit. There is no agent,
 * and it has no way to answer follow-ups, confirm onset, give consent, or submit
 * (sickway.md §6.1: no voice agent can supply consent).
 */
export function VoiceInput({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    // The server commits a segment at each natural pause.
    commitStrategy: CommitStrategy.VAD,
    onCommittedTranscript: ({ text }) => {
      if (text.trim()) onTranscript(text.trim());
    },
    onError: () => setNotice(`Dictation stopped. ${FALLBACK}`),
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
        setNotice(`Microphone access was not granted. ${FALLBACK}`);
        return;
      }
      // Only the permission was needed; the SDK opens its own stream.
      stream.getTracks().forEach((track) => track.stop());

      const response = await apiFetch("/api/voice/scribe-token", { method: "POST" });
      if (!response.ok) {
        setNotice(`Dictation is unavailable right now. ${FALLBACK}`);
        return;
      }
      const { token } = (await response.json()) as { token: string };
      await scribe.connect({ token, microphone: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setNotice(`Dictation could not start. ${FALLBACK}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {scribe.isConnected ? (
          <Button type="button" variant="outline" className="h-11" onClick={() => scribe.disconnect()}>
            Stop dictation
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-11" disabled={disabled || starting} onClick={() => void start()}>
            {starting ? "Starting…" : "Dictate instead"}
          </Button>
        )}
        <Badge variant="outline" role="status">
          {scribe.isConnected ? "Listening — live speech to text" : "Dictation off"}
        </Badge>
      </div>
      {scribe.isConnected && (
        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {scribe.partialTranscript ? `Hearing: ${scribe.partialTranscript}` : "Speak now. Your words appear in the box above, where you can edit them."}
        </p>
      )}
      {notice && (
        <p role="alert" className="text-sm">
          {notice}
        </p>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        Dictation only fills the text box. Fictional details only. Everything after this step, including consent, is done on screen.
      </p>
    </div>
  );
}
