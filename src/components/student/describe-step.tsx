"use client";

import { useState } from "react";
import { VoiceInput } from "@/components/student/voice-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractResponseSchema, type CandidateIntakeFields } from "@/lib/api-contracts";
import { useLanguage } from "@/lib/client/language-store";
import { apiFetch } from "@/lib/client/session-store";

const MAX_LENGTH = 2000;

type Notice = { title: string; body: string } | null;

/**
 * Typed description → candidate fields. Nothing is shared with the clinic here.
 * When extraction is unavailable the student continues by entering fields by
 * hand; the seeded case is never substituted for what they typed.
 */
export function DescribeStep({
  onExtracted,
  onUsePrepared,
  voiceEnabled = false,
}: {
  onExtracted: (transcript: string, fields: CandidateIntakeFields | null) => void;
  /** Explicit choice of the scripted case. Never triggered by a failure or by what was typed. */
  onUsePrepared: () => void;
  /** True only when the server runs with VOICE_MODE=live. */
  voiceEnabled?: boolean;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [manualOffer, setManualOffer] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const transcript = text.trim();
    if (!transcript) return;

    setPending(true);
    setNotice(null);
    setManualOffer(false);
    try {
      const response = await apiFetch("/api/extract", {
        method: "POST",
        body: JSON.stringify({ text: transcript }),
      });
      if (response.status === 401) {
        setNotice({ title: t.describe.sessionEndedTitle, body: t.describe.sessionEndedBody });
        return;
      }
      if (!response.ok) throw new Error();

      const result = extractResponseSchema.parse(await response.json());
      if (result.outsideScenario) {
        // The server's message is English; show the reviewed copy for this screen's language.
        setNotice({ title: t.describe.outsideTitle, body: t.describe.outsideBody });
        return;
      }
      onExtracted(result.transcript, result.candidateFields);
    } catch {
      setNotice({
        title: t.describe.failedTitle,
        body: t.describe.failedBody,
      });
      setManualOffer(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Label htmlFor="intake-text" className="text-base font-semibold">
        {t.describe.label}
      </Label>
      <Textarea
        id="intake-text"
        value={text}
        maxLength={MAX_LENGTH}
        rows={4}
        placeholder={t.describe.placeholder}
        onChange={(event) => setText(event.target.value)}
        className="text-base"
      />
      <p className="text-xs leading-5 text-muted-foreground">
        {t.describe.fictionalOnly} {t.describe.ownWords}
      </p>
      {voiceEnabled && (
        <VoiceInput
          disabled={pending}
          onTranscript={(heard) =>
            setText((current) => `${current.trim()}${current.trim() ? " " : ""}${heard}`.slice(0, MAX_LENGTH))
          }
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="brand" className="h-11" disabled={pending || text.trim() === ""}>
          {pending ? t.describe.reading : t.describe.continue}
        </Button>
        {manualOffer && (
          <Button type="button" variant="outline" className="h-11" onClick={() => onExtracted(text.trim(), null)}>
            {t.describe.enterMyself}
          </Button>
        )}
      </div>
      <div className="border-t pt-3">
        <Button type="button" variant="ghost" className="h-11 px-2" disabled={pending} onClick={onUsePrepared}>
          {t.describe.usePrepared}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          {t.describe.preparedNote}
        </p>
      </div>
      {notice && (
        <Alert variant={manualOffer ? "destructive" : "default"}>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.body}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
