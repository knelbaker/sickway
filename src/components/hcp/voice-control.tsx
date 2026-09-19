"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import MatrixOrb from "@/components/ui/matrix-orb";
import { apiFetch } from "@/lib/client/session-store";
import { USE_TYPED_CONTROLS } from "@/lib/voice-tools";
import { useLanguage } from "@/lib/client/language-store";

/** What the agent's three client tools are allowed to do. Each returns the text the agent hears. */
export type VoiceActions = {
  showOptions: (query: string) => Promise<string>;
  /** Receives the clinician's own transcribed words, never the agent's wording. */
  requestResources: (clinicianWords: string) => Promise<string>;
  proposePacket: (choice: { therapyName: string; pharmacyName: string; languages: string }) => string;
};

type Line = { role: "user" | "agent"; text: string };


/**
 * Optional clinician voice (rendered only when VOICE_MODE=live). Voice is an
 * input layer: it presses the same controls, through the same server routes,
 * and cannot confirm anything. If the microphone, token, or connection fails,
 * the typed controls are untouched.
 */
export function VoiceControl({ actions }: { actions: VoiceActions }) {
  return (
    <ConversationProvider>
      <VoiceSession actions={actions} />
    </ConversationProvider>
  );
}

function VoiceSession({ actions }: { actions: VoiceActions }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const lastClinicianWords = useRef("");

  const v = useLanguage().t.clinician.voice;
  const conversation = useConversation({
    clientTools: {
      show_options: async ({ query }: { query?: string }) => actions.showOptions(String(query ?? "")),
      // The manufacturer resource gate must judge what the clinician said, not what the
      // agent decided to write, so the agent's parameter is deliberately ignored here.
      request_manufacturer_resources: async () =>
        lastClinicianWords.current ? actions.requestResources(lastClinicianWords.current) : USE_TYPED_CONTROLS,
      propose_packet: async (choice: { therapy_name?: string; pharmacy_name?: string; languages?: string }) =>
        actions.proposePacket({
          therapyName: String(choice.therapy_name ?? ""),
          pharmacyName: String(choice.pharmacy_name ?? ""),
          languages: String(choice.languages ?? "both"),
        }),
    },
    onMessage: ({ message, role }) => {
      if (role === "user") lastClinicianWords.current = message;
      setLines((current) => [...current.slice(-19), { role, text: message }]);
    },
    onError: () => setNotice(`${v.problem} ${v.fallback}`),
    onDisconnect: (details) => {
      if (details.reason !== "user") setNotice(`${v.disconnected} ${v.fallback}`);
    },
  });

  // Never leave a conversation (and its credits) running after the encounter view closes.
  const endSession = conversation.endSession;
  useEffect(() => () => endSession(), [endSession]);

  const connected = conversation.status === "connected";
  const busy = starting || conversation.status === "connecting";

  async function start() {
    setNotice(null);
    setStarting(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setNotice(`${v.micDenied} ${v.fallback}`);
        return;
      }
      // Only the permission was needed; the SDK opens its own stream.
      stream.getTracks().forEach((track) => track.stop());

      const response = await apiFetch("/api/voice/conversation-token", { method: "POST" });
      if (!response.ok) {
        setNotice(`${v.unavailable} ${v.fallback}`);
        return;
      }
      const { token } = (await response.json()) as { token: string };
      setLines([]);
      lastClinicianWords.current = "";
      conversation.startSession({ conversationToken: token, connectionType: "webrtc" });
    } catch {
      setNotice(`${v.failed} ${v.fallback}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <section aria-labelledby="voice-heading" className="flex flex-col gap-3 glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="voice-heading" className="display text-xl">
            {v.title}
          </h3>
          <p className="text-xs leading-5 text-muted-foreground">
            {v.body}
            {v.englishOnly && ` ${v.englishOnly}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* The orb is the agent's state at a glance; its label is the status for screen readers. */}
          <MatrixOrb
            state={connected ? (conversation.isSpeaking ? "thinking" : "listening") : busy ? "thinking" : "idle"}
            labels={{ idle: v.off, listening: v.listening, thinking: connected ? v.speaking : v.connecting }}
            size={40}
            color="#c8121b"
            className="flex-row gap-2"
          />
          {connected ? (
            <Button type="button" variant="outline" className="h-11" onClick={() => conversation.endSession()}>
              {v.stopVoice}
            </Button>
          ) : (
            <Button type="button" className="h-11" disabled={busy} onClick={() => void start()}>
              {v.start}
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <Alert>
          <AlertTitle>{v.offTitle}</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {lines.length > 0 && (
        <ol aria-label={v.transcript} aria-live="polite" className="flex max-h-48 flex-col gap-1.5 overflow-y-auto text-sm">
          {lines.map((line, index) => (
            <li key={index} lang="en" className={line.role === "user" ? "font-medium" : "text-muted-foreground"}>
              <span className="mr-1.5 text-xs uppercase">{line.role === "user" ? v.you : v.agent}</span>
              {line.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
