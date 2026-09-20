"use client";

import { QrCode } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
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

/** Starting a session, shared by the Demo menu and the landing page's own button. Resolves true on success. */
export function useStartSession() {
  const { language, t } = useLanguage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch("/api/demo-session", { method: "POST" });
      if (!response.ok) throw new Error();
      setSessionToken(demoSessionResponseSchema.parse(await response.json()).token);
      // The language chosen on this entry screen applies to the session it starts.
      carryLanguageIntoSession(language);
      return true;
    } catch {
      setError(t.home.startFailed);
      return false;
    } finally {
      setPending(false);
    }
  }

  return { start, pending, error };
}

/** Start a demo session on this device, then pair the second device with the join link. */
export function SessionPanel() {
  const token = useSessionToken();
  const { t } = useLanguage();
  const { start, pending, error } = useStartSession();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

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
          <Button variant="brand" className="min-h-12 px-7 text-base" onClick={() => void start()} disabled={pending}>
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
  // A phone cannot open "localhost": that name means the phone itself. Say so instead of showing a code that fails.
  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

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
          <Button variant="outline" className="shrink-0 sm:whitespace-nowrap" onClick={copy}>
            {copied ? t.home.copied : t.home.copy}
          </Button>
        </div>

        {/* The same link as a QR code, for a phone's camera. It is drawn here in the browser: the link
            carries the session token, so it is never sent to an outside QR service. */}
        <div>
          <Button
            variant="outline"
            aria-expanded={showQr}
            aria-controls="join-qr"
            className="sm:whitespace-nowrap"
            onClick={() => setShowQr((shown) => !shown)}
          >
            <QrCode aria-hidden className="size-4" />
            {showQr ? t.home.hideQr : t.home.showQr}
          </Button>
        </div>
        {showQr && (
          <figure id="join-qr" className="flex flex-col items-center gap-2 self-center rounded-2xl border border-ink/10 bg-white p-4">
            {/* Black on white with a quiet zone: the combination phone cameras read most reliably. */}
            <QRCodeSVG value={joinLink} size={208} level="M" marginSize={2} title={t.home.qrTitle} role="img" />
            <figcaption className="max-w-[16rem] text-center text-xs leading-5 text-muted-foreground">{t.home.qrHelp}</figcaption>
            {isLocalhost && (
              <p role="note" className="max-w-[16rem] text-center text-xs leading-5 font-medium text-ink">
                {t.home.qrLocalhost}
              </p>
            )}
          </figure>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          {t.home.joinNote}
        </p>
      </div>

      <RoleLinks />
    </div>
  );
}
