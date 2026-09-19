"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RoleLinks } from "@/components/session/session-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { demoSessionResponseSchema } from "@/lib/api-contracts";
import { setSessionToken } from "@/lib/client/session-store";

type JoinState =
  | { status: "checking" }
  | { status: "joined"; sessionId: string }
  | { status: "failed" };

/** Confirms the token with the server before storing it, then offers the role screens. */
export function JoinSession({ token }: { token: string | null }) {
  const [state, setState] = useState<JoinState>(token ? { status: "checking" } : { status: "failed" });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetch("/api/demo-session", { headers: { "x-demo-session": token }, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const session = demoSessionResponseSchema.parse(await response.json());
        if (cancelled) return;
        setSessionToken(token);
        setState({ status: "joined", sessionId: session.sessionId });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "failed" });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "checking") {
    return <p className="text-sm text-muted-foreground">Joining demo session…</p>;
  }

  if (state.status === "failed") {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="destructive">
          <AlertTitle>This join link is not valid</AlertTitle>
          <AlertDescription>
            The demo session may have expired or been reset. Open a fresh join link from the
            first device, or start a new session.
          </AlertDescription>
        </Alert>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">Back to start</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Joined demo session</span>
        <Badge variant="secondary" className="font-mono">
          {state.sessionId.slice(0, 8)}
        </Badge>
      </div>
      <p className="text-sm leading-6">Choose the screen for this device.</p>
      <RoleLinks />
    </div>
  );
}
