"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoSessionResponseSchema } from "@/lib/api-contracts";
import { carryLanguageIntoSession, useLanguage } from "@/lib/client/language-store";
import {
  apiFetch,
  sessionIdFromToken,
  setSessionToken,
  useSessionToken,
} from "@/lib/client/session-store";

export function RoleLinks() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button asChild>
        <Link href="/s">{t.home.studentScreen}</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/hcp">{t.home.clinicianScreen}</Link>
      </Button>
    </div>
  );
}

/** Start a demo session on this device, then pair the second device with the join link. */
export function SessionPanel() {
  const token = useSessionToken();
  const { language, t } = useLanguage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch("/api/demo-session", { method: "POST" });
      if (!response.ok) throw new Error();
      setSessionToken(demoSessionResponseSchema.parse(await response.json()).token);
      // The language chosen on this entry screen applies to the session it starts.
      carryLanguageIntoSession(language);
    } catch {
      setError(t.home.startFailed);
    } finally {
      setPending(false);
    }
  }

  // Undefined until the browser has read its stored token.
  if (token === undefined) {
    return <p className="text-sm text-muted-foreground">{t.home.loading}</p>;
  }

  if (token === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-6">
          {t.home.startHelp}
        </p>
        <div>
          <Button onClick={start} disabled={pending}>
            {pending ? t.home.starting : t.home.start}
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t.home.startFailedTitle}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  const joinLink = `${window.location.origin}/join?t=${encodeURIComponent(token)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{t.home.session}</span>
        <Badge variant="secondary" className="font-mono">
          {sessionIdFromToken(token)?.slice(0, 8)}
        </Badge>
        <span className="text-muted-foreground">{t.home.syntheticOnly}</span>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="join-link">{t.home.joinLabel}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="join-link"
            readOnly
            value={joinLink}
            className="font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button variant="outline" onClick={copy}>
            {copied ? t.home.copied : t.home.copy}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {t.home.joinNote}
        </p>
      </div>

      <RoleLinks />
    </div>
  );
}
