"use client";

import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { data: packet, error } = usePolling(`/api/packet/${encodeURIComponent(packetId)}`, packetViewSchema, REFRESH_MS);

  if (!packet) {
    if (!error) return <p className="text-sm text-muted-foreground">Loading packet…</p>;
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Packet unavailable</h1>
          </CardTitle>
          <CardDescription>
            {error === "unavailable"
              ? "The packet could not be loaded. Check the connection; this page will retry."
              : "This packet is not available in this demo session. Packets can be opened only from the paired devices of the session they belong to."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/s">Back to the student screen</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { display } = packet;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Demo packet for {display.patientName}</h1>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <Badge>Available in demo</Badge>
          <span>Synthetic packet. It exists only inside this demo session.</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="text-sm">
          <Row label="Demo therapy">
            <span className="font-medium">{display.therapyName}</span>
            <Badge variant="outline">{display.generic ? "Generic" : "Brand"}</Badge>
            <Badge variant="secondary">Synthetic — fictional therapy</Badge>
          </Row>
          <Row label="Pharmacy">
            <span className="font-medium">{display.pharmacyName}</span>
            <Badge variant="secondary">Fictional pharmacy</Badge>
            <span className="text-muted-foreground">{display.stockStatus}</span>
          </Row>
          <Row label="Estimated cost">
            <span className="font-medium">{formatMockDollars(packet.mockPrice)}</span>
            <Badge variant="secondary">Mock cost</Badge>
          </Row>
          <Row label="Coverage">
            <span>
              {display.planName} · {display.coverageStatus}
            </span>
            <Badge variant="secondary">{display.coverageMockLabel}</Badge>
          </Row>
        </dl>

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
              Included by the demo clinician
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
          <AlertTitle>What this packet is not</AlertTitle>
          <AlertDescription>
            Educational demo text, not clinically validated. No prescription was written, no pharmacy
            or clinic was contacted, and no coverage was checked.
          </AlertDescription>
        </Alert>

        <div>
          <Button variant="outline" asChild>
            <Link href="/s">Back to the student screen</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
