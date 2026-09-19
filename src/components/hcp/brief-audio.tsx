"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/client/language-store";
import { briefAudioMode, PREPARED_BRIEF_AUDIO_SRC } from "@/lib/voice";

const noSubscription = () => () => {};

/**
 * Manual Play / Stop for the brief on screen. Autoplay is never required. The
 * mode is always labelled, so a prepared recording is never mistaken for live
 * voice (§10), and the brief's text stays visible whatever happens here.
 */
export function BriefAudio({ script, preparedScript }: { script: string; preparedScript: string }) {
  const b = useLanguage().t.clinician.brief;
  const speechSynthesisSupported = useSyncExternalStore(
    noSubscription,
    () => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    () => false,
  );
  const [preparedFileFailed, setPreparedFileFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const mode = briefAudioMode(script, preparedScript, { speechSynthesis: speechSynthesisSupported, preparedFileFailed });

  function stop() {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (speechSynthesisSupported) window.speechSynthesis.cancel();
    setPlaying(false);
  }

  // Stop when the brief changes or the view closes, so audio never outlives the text it belongs to.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [script]);

  function speak() {
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = "en-US";
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  }

  async function play() {
    if (mode === "browser_speech") return speak();
    if (mode !== "prepared_recording" || !audioRef.current) return;
    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      // Missing or blocked file: fall back to speaking the same, current script.
      setPreparedFileFailed(true);
      if (speechSynthesisSupported) speak();
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-muted/50 p-3">
      {mode !== "unavailable" && (
        <Button type="button" className="h-11 min-w-28" onClick={playing ? stop : play}>
          {playing ? b.stop : b.play}
        </Button>
      )}
      <Badge variant="outline" role="status">
        {b.audio[mode]}
      </Badge>
      {mode === "prepared_recording" && (
        <>
          <span className="text-xs text-muted-foreground">{b.preparedNote}</span>
          <audio
            ref={audioRef}
            src={PREPARED_BRIEF_AUDIO_SRC}
            preload="none"
            onEnded={() => setPlaying(false)}
            onError={() => {
              setPreparedFileFailed(true);
              setPlaying(false);
            }}
          />
        </>
      )}
      {mode === "browser_speech" && (
        <span className="text-xs text-muted-foreground">{b.browserNote}</span>
      )}
    </div>
  );
}
