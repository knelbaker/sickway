"use client";

import Link from "next/link";
import { SickwayMark } from "@/components/brand/sickway-logo";
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
      <Card lang={language} className="mx-auto w-full max-w-2xl">
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
    <article lang={language} className="ticket mx-auto mt-2 w-full max-w-2xl sm:mt-4">
      {/* The stub: what this is, and the one number a student looks for, with its mock label beside it. */}
      <header className="ticket-top flex flex-col gap-5 rounded-b-[1.75rem] bg-[#fffdf6] px-6 pt-10 pb-7 sm:px-9">
        <SickwayMark className="h-7 self-start" />
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl">{p.title(display.patientName)}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <Badge>{p.available}</Badge>
              <span>{p.synthetic}</span>
            </p>
          </div>
          <dl className="shrink-0 sm:text-right">
            <dt className="text-sm text-ink-soft">{p.cost}</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="display text-5xl leading-none">{formatMockDollars(packet.mockPrice)}</span>
              <Badge variant="secondary">{p.mockCost}</Badge>
            </dd>
          </dl>
        </div>
      </header>

      <div className="ticket-bottom relative flex flex-col gap-6 rounded-t-[1.75rem] bg-[#fffdf6] px-6 pt-8 pb-12 sm:px-9">
        {/* The perforation, between the two side notches. */}
        <span aria-hidden className="absolute inset-x-7 top-0 border-t-2 border-dashed border-ink/25" />
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
          <section key={instructions.language} lang={instructions.language} className="rounded-2xl border border-dashed border-ink-soft p-5">
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
          <section aria-labelledby="packet-resources" className="rounded-2xl border border-ink/12 p-5">
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
      </div>
    </article>
  );
}
