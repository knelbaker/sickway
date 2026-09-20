"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/session-store";
import { useLanguage } from "@/lib/client/language-store";
import { matchesPreparedScript, PREPARED_BRIEF_AUDIO_SRC } from "@/lib/voice";

type Props = { encounterId: string; script: string; preparedScript: string };

export function BriefAudio(props: Props) {
  // A changed brief or encounter must discard its audio and any pending request.
  return <BriefPlayer key={`${props.encounterId}:${props.script}`} {...props} />;
}

function BriefPlayer({ encounterId, script, preparedScript }: Props) {
  const b = useLanguage().t.clinician.brief;
  const [generated, setGenerated] = useState(!matchesPreparedScript(script, preparedScript));
  const [state, setState] = useState<"idle" | "loading" | "playing" | "unavailable">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const generatedUrl = useRef<string | null>(null);
  const active = state === "loading" || state === "playing";
  const mode = state === "unavailable" ? "unavailable" : generated ? "elevenlabs" : "prepared_recording";

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      requestRef.current?.abort();
      audio?.pause();
      if (generatedUrl.current) URL.revokeObjectURL(generatedUrl.current);
    };
  }, []);

  function stop() {
    requestRef.current?.abort();
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setState("idle");
  }

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setState("loading");
    try {
      if (!generated) {
        try {
          audio.src = PREPARED_BRIEF_AUDIO_SRC;
          await audio.play();
          if (!controller.signal.aborted) setState("playing");
          return;
        } catch {
          if (controller.signal.aborted) return;
          setGenerated(true);
        }
      }
      if (!generatedUrl.current) {
        const response = await apiFetch(`/api/encounters/${encodeURIComponent(encounterId)}/audio`, {
          method: "POST",
          body: JSON.stringify({ spokenScript: script }),
          signal: controller.signal,
        });
        if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/mpeg")) throw new Error("Audio unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (!blob.size) throw new Error("Empty audio");
        generatedUrl.current = URL.createObjectURL(blob);
      }
      audio.src = generatedUrl.current;
      await audio.play();
      if (!controller.signal.aborted) setState("playing");
    } catch {
      if (!controller.signal.aborted) setState("unavailable");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-muted/50 p-3">
      <Button type="button" className="h-11 min-w-28" onClick={active ? stop : play}>
        {active ? b.stop : b.play}
      </Button>
      <Badge variant="outline" role="status">
        {state === "loading" ? b.preparingAudio : b.audio[mode]}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {generated ? b.generatedNote : b.preparedNote}
      </span>
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setState("idle")}
        onError={() => {
          if (generatedUrl.current) URL.revokeObjectURL(generatedUrl.current);
          generatedUrl.current = null;
          // play() handles errors during startup, including a missing prepared file.
          if (!requestRef.current) setState("unavailable");
        }}
      />
    </div>
  );
}
