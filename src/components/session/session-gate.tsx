"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionToken } from "@/lib/client/session-store";

/** Renders its children only on a device that is paired with a demo session. */
export function SessionGate({ title, children }: { title: string; children: ReactNode }) {
  const token = useSessionToken();

  if (token === undefined) {
    return <p className="text-sm text-muted-foreground">Loading demo session…</p>;
  }

  if (token === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{title}</h1>
          </CardTitle>
          <CardDescription>
            This device is not paired with a demo session yet. Start one, or open the join link
            from the other device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">Start or join a demo session</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
