"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/client/language-store";
import { useSessionToken } from "@/lib/client/session-store";

/** Renders its children only on a device that is paired with a demo session. */
export function SessionGate({ screen, children }: { screen: "student" | "clinician" | "packet"; children: ReactNode }) {
  const token = useSessionToken();
  const { t } = useLanguage();

  if (token === undefined) {
    return <p className="text-sm text-muted-foreground">{t.gate.loading}</p>;
  }

  if (token === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {screen === "clinician" ? <h1 lang="en">Clinician workspace</h1> : <h1>{screen === "student" ? t.flow.title : t.packet.unavailableTitle}</h1>}
          </CardTitle>
          <CardDescription>
            {t.gate.body}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">{t.gate.cta}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
