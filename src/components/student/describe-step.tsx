"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractResponseSchema, type CandidateIntakeFields } from "@/lib/api-contracts";
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
}: {
  onExtracted: (transcript: string, fields: CandidateIntakeFields | null) => void;
  /** Explicit choice of the scripted case. Never triggered by a failure or by what was typed. */
  onUsePrepared: () => void;
}) {
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
        setNotice({ title: "Demo session ended", body: "Start or join a demo session again from the home page." });
        return;
      }
      if (!response.ok) throw new Error();

      const result = extractResponseSchema.parse(await response.json());
      if (result.outsideScenario) {
        setNotice({ title: "Outside this demo scenario", body: result.message });
        return;
      }
      onExtracted(result.transcript, result.candidateFields);
    } catch {
      setNotice({
        title: "Could not read that automatically",
        body: "Nothing was filled in for you. You can try again, or continue and enter the details yourself.",
      });
      setManualOffer(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Label htmlFor="intake-text" className="text-base font-semibold">
        What is going on today?
      </Label>
      <Textarea
        id="intake-text"
        value={text}
        maxLength={MAX_LENGTH}
        rows={4}
        placeholder="For example: I woke up with a 102 fever, my whole body aches, it started yesterday morning, and I have an exam at 2."
        onChange={(event) => setText(event.target.value)}
        className="text-base"
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Use fictional details only. Do not enter real health information.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11" disabled={pending || text.trim() === ""}>
          {pending ? "Reading…" : "Continue"}
        </Button>
        {manualOffer && (
          <Button type="button" variant="outline" className="h-11" onClick={() => onExtracted(text.trim(), null)}>
            Enter details myself
          </Button>
        )}
      </div>
      <div className="border-t pt-3">
        <Button type="button" variant="ghost" className="h-11 px-2" disabled={pending} onClick={onUsePrepared}>
          Use prepared demo instead
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          Loads the scripted demo case. It is labelled as prepared fixture output on every screen and
          is never used in place of something you typed.
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
