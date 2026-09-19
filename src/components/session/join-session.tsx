"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RoleLinks } from "@/components/session/session-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { demoSessionResponseSchema } from "@/lib/api-contracts";
import { carryLanguageIntoSession, getLanguage, useLanguage } from "@/lib/client/language-store";
import { setSessionToken } from "@/lib/client/session-store";

type JoinState =
  | { status: "checking" }
  | { status: "joined"; sessionId: string }
  | { status: "failed" };

/** Confirms the token with the server before storing it, then offers the role screens. */
export function JoinSession({ token }: { token: string | null }) {
  const { t } = useLanguage();
  const [state, setState] = useState<JoinState>(token ? { status: "checking" } : { status: "failed" });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // A join link from before a reset leads on to the session that replaced it.
    async function join(candidate: string, hops: number): Promise<void> {
      const response = await fetch("/api/demo-session", { headers: { "x-demo-session": candidate }, cache: "no-store" });
      if (response.status === 409 && hops > 0) {
        const { joinToken } = (await response.json()) as { joinToken?: string };
        if (joinToken) return join(joinToken, hops - 1);
      }
      if (!response.ok) throw new Error();
      const session = demoSessionResponseSchema.parse(await response.json());
      if (cancelled) return;
      // Keep the language chosen on this entry screen for the session being joined.
      const chosen = getLanguage();
      setSessionToken(candidate);
      carryLanguageIntoSession(chosen);
      setState({ status: "joined", sessionId: session.sessionId });
    }

    join(token, 5)
.catch(() => {
      if (!cancelled) setState({ status: "failed" });
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "checking") {
    return <p className="text-sm text-muted-foreground">{t.join.joining}</p>;
  }

  if (state.status === "failed") {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="destructive">
          <AlertTitle>{t.join.invalidTitle}</AlertTitle>
          <AlertDescription>
            {t.join.invalidBody}
          </AlertDescription>
        </Alert>
        <div>
          <Button variant="outline" asChild>
            <Link href="/">{t.join.back}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{t.join.joined}</span>
        <Badge variant="secondary" className="font-mono">
          {state.sessionId.slice(0, 8)}
        </Badge>
      </div>
      <p className="text-sm leading-6">{t.join.choose}</p>
      <RoleLinks />
    </div>
  );
}
