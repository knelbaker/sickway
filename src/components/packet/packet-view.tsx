"use client";

import Link from "next/link";
import { PollStatus } from "@/components/poll-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/client/language-store";
import { usePolling } from "@/lib/client/use-polling";
import { formatMockDollars } from "@/lib/format";
import { packetViewSchema } from "@/lib/packet-view";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", es: "Español" };

// A packet does not change after it is attached; refresh rarely, mainly to recover from a dropped connection.
const REFRESH_MS = 30_000;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t py-2 first:border-t-0 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex flex-1 flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}

/** The returned packet. Everything here is synthetic; the status is "available in demo" and nothing more. */
export function PacketView({ packetId }: { packetId: string }) {
  const { language, t } = useLanguage();
  const p = t.packet;
  const poll = usePolling(`/api/packet/${encodeURIComponent(packetId)}`, packetViewSchema, REFRESH_MS);
  const { data: packet, error } = poll;

  if (!packet) {
    if (!error) return <p className="text-sm text-muted-foreground">{p.loading}</p>;
    return (
      <Card lang={language}>
        <CardHeader>
          <CardTitle>
            <h1>{p.unavailableTitle}</h1>
          </CardTitle>
          <CardDescription>
            {error === "unavailable"
              ? p.unavailableRetry
              : p.unavailableBody}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/s">{p.back}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { display } = packet;

  return (
    <Card lang={language}>
      <CardHeader>
        <CardTitle>
          <h1>{p.title(display.patientName)}</h1>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <Badge>{p.available}</Badge>
          <span>{p.synthetic}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="text-sm">
          <Row label={p.therapy}>
            <span className="font-medium">{display.therapyName}</span>
            <Badge variant="outline">{display.generic ? p.generic : p.brand}</Badge>
            <Badge variant="secondary">{p.fictionalTherapy}</Badge>
          </Row>
          <Row label={p.pharmacy}>
            <span className="font-medium">{display.pharmacyName}</span>
            <Badge variant="secondary">{p.fictionalPharmacy}</Badge>
            <span className="text-muted-foreground">{display.stockStatus}</span>
          </Row>
          <Row label={p.cost}>
            <span className="font-medium">{formatMockDollars(packet.mockPrice)}</span>
            <Badge variant="secondary">{p.mockCost}</Badge>
          </Row>
          <Row label={p.coverage}>
            <span>
              {display.planName} · {display.coverageStatus}
            </span>
            <Badge variant="secondary">{display.coverageMockLabel}</Badge>
          </Row>
        </dl>

        <p className="text-xs leading-5 text-muted-foreground">
          {p.genericExplain} {p.coverageExplain}
        </p>

        {/* The clinician chooses the packet's languages; say so rather than translating on the fly. */}
        {p.missingLanguage && !display.instructions.some((item) => item.language === language) && (
          <Alert>
            <AlertDescription>{p.missingLanguage}</AlertDescription>
          </Alert>
        )}

        {display.instructions.map((instructions) => (
          <section key={instructions.language} lang={instructions.language} className="rounded-lg border p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">
                {instructions.title} · {LANGUAGE_NAMES[instructions.language] ?? instructions.language}
              </h2>
              <Badge variant="secondary">{instructions.mockLabel}</Badge>
            </div>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-6">
              {instructions.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{instructions.disclaimer}</p>
          </section>
        ))}

        {display.resources.length > 0 && (
          <section aria-labelledby="packet-resources" className="rounded-lg border p-4">
            <h2 id="packet-resources" className="mb-2 text-sm font-semibold">
              {p.included}
            </h2>
            <ul className="flex flex-col gap-3">
              {display.resources.map((resource) => (
                <li key={resource.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{resource.title}</span>
                    <Badge variant="secondary">{resource.mockLabel}</Badge>
                  </div>
                  <p className="mt-1 leading-6 text-muted-foreground">{resource.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Alert>
          <AlertTitle>{p.notTitle}</AlertTitle>
          <AlertDescription>
            {p.notBody}
          </AlertDescription>
        </Alert>

        {poll.error === "unavailable" && <PollStatus poll={poll} localized />}

        <div>
          <Button variant="outline" asChild>
            <Link href="/s">{p.back}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
