"use client";

import { JoinSession } from "@/components/session/join-session";
import { SessionPanel } from "@/components/session/session-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/client/language-store";

/** The home and join cards, in the language chosen on the entry screen. */
export function HomeCard() {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 lang="en">Sick Day + Doorway</h1>
        </CardTitle>
        <CardDescription>{t.home.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <SessionPanel />
      </CardContent>
    </Card>
  );
}

export function JoinCard({ token }: { token: string | null }) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{t.join.title}</h1>
        </CardTitle>
        <CardDescription>{t.join.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <JoinSession token={token} />
      </CardContent>
    </Card>
  );
}
