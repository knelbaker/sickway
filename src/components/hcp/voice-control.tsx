"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/session-store";
import { USE_TYPED_CONTROLS } from "@/lib/voice-tools";

/** What the agent's three client tools are allowed to do. Each returns the text the agent hears. */
export type VoiceActions = {
  showOptions: (query: string) => Promise<string>;
  /** Receives the clinician's own transcribed words, never the agent's wording. */
  requestResources: (clinicianWords: string) => Promise<string>;
  proposePacket: (choice: { therapyName: string; pharmacyName: string; languages: string }) => string;
};

type Line = { role: "user" | "agent"; text: string };

const FALLBACK = "The typed controls below do everything voice does.";

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
    onError: () => setNotice(`Voice had a problem. ${FALLBACK}`),
    onDisconnect: (details) => {
      if (details.reason !== "user") setNotice(`Voice disconnected. ${FALLBACK}`);
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
        setNotice(`Microphone access was not granted. ${FALLBACK}`);
        return;
      }
      // Only the permission was needed; the SDK opens its own stream.
      stream.getTracks().forEach((track) => track.stop());

      const response = await apiFetch("/api/voice/conversation-token", { method: "POST" });
      if (!response.ok) {
        setNotice(`Voice is unavailable right now. ${FALLBACK}`);
        return;
      }
      const { token } = (await response.json()) as { token: string };
      setLines([]);
      lastClinicianWords.current = "";
      conversation.startSession({ conversationToken: token, connectionType: "webrtc" });
    } catch {
      setNotice(`Voice could not start. ${FALLBACK}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <section aria-labelledby="voice-heading" className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="voice-heading" className="text-sm font-semibold">
            Voice (optional)
          </h3>
          <p className="text-xs leading-5 text-muted-foreground">
            Live voice agent. It uses the same controls as typing, reads only mock data, and cannot
            confirm or attach anything.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" role="status">
            {connected ? (conversation.isSpeaking ? "Speaking" : "Listening") : busy ? "Connecting…" : "Off"}
          </Badge>
          {connected ? (
            <Button type="button" variant="outline" className="h-11" onClick={() => conversation.endSession()}>
              Stop voice
            </Button>
          ) : (
            <Button type="button" className="h-11" disabled={busy} onClick={() => void start()}>
              Start voice
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <Alert>
          <AlertTitle>Voice is off</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {lines.length > 0 && (
        <ol aria-label="Voice transcript" aria-live="polite" className="flex max-h-48 flex-col gap-1.5 overflow-y-auto text-sm">
          {lines.map((line, index) => (
            <li key={index} className={line.role === "user" ? "font-medium" : "text-muted-foreground"}>
              <span className="mr-1.5 text-xs uppercase">{line.role === "user" ? "You" : "Agent"}</span>
              {line.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
