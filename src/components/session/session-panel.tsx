"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoSessionResponseSchema } from "@/lib/api-contracts";
import {
  apiFetch,
  sessionIdFromToken,
  setSessionToken,
  useSessionToken,
} from "@/lib/client/session-store";

export function RoleLinks() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button asChild>
        <Link href="/s">Student screen</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/hcp">Clinician screen</Link>
      </Button>
    </div>
  );
}

/** Start a demo session on this device, then pair the second device with the join link. */
export function SessionPanel() {
  const token = useSessionToken();
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
    } catch {
      setError("Could not start a demo session. Check the connection and try again.");
    } finally {
      setPending(false);
    }
  }

  // Undefined until the browser has read its stored token.
  if (token === undefined) {
    return <p className="text-sm text-muted-foreground">Loading demo session…</p>;
  }

  if (token === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-6">
          Start an isolated synthetic session on this device, then open the join link on the
          second device.
        </p>
        <div>
          <Button onClick={start} disabled={pending}>
            {pending ? "Starting…" : "Start demo session"}
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Session not started</AlertTitle>
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
        <span>Demo session</span>
        <Badge variant="secondary" className="font-mono">
          {sessionIdFromToken(token)?.slice(0, 8)}
        </Badge>
        <span className="text-muted-foreground">Synthetic data only.</span>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="join-link">Join link for the second device</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="join-link"
            readOnly
            value={joinLink}
            className="font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button variant="outline" onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Anyone with this link can see this demo session. It pairs two devices for a synthetic
          demo and is not a secure login.
        </p>
      </div>

      <RoleLinks />
    </div>
  );
}
