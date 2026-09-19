"use client";

import Link from "next/link";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/client/language-store";
import type { EncounterStatus } from "@/lib/schemas";

/**
 * What the student sees after sharing. Honest by construction: no wording here
 * implies an appointment, a held slot, verified coverage, or anything sent out.
 */
export function StatusView({
  status,
  profile,
  packetId,
}: {
  status: EncounterStatus;
  profile: StudentProfileSummary;
  packetId?: string;
}) {
  const { t } = useLanguage();
  if (status === "packet_available" && packetId) {
    return (
      <Alert aria-live="polite">
        <AlertTitle>{t.status.packetTitle}</AlertTitle>
        <AlertDescription>
          <p>{t.status.packetBody}</p>
          <p className="mt-1 font-medium">{t.status.bookingNotConnected}</p>
          <div className="mt-3">
            <Button className="h-11" asChild>
              <Link href={`/packet/${encodeURIComponent(packetId)}`}>{t.status.openPacket}</Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "emergency") {
    return (
      <Alert variant="destructive" aria-live="assertive">
        <AlertTitle>{t.status.emergencyTitle}</AlertTitle>
        <AlertDescription>
          <p>{t.status.emergencyBody}</p>
          <p className="mt-2">{t.status.emergencyAction}</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "needs_review") {
    return (
      <Alert aria-live="polite">
        <AlertTitle>{t.status.reviewTitle}</AlertTitle>
        <AlertDescription>
          <p>{t.status.reviewBody}</p>
          <p className="mt-2 font-medium">{t.status.bookingNotConnected}</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert aria-live="polite">
      <AlertTitle>{t.status.readyTitle}</AlertTitle>
      <AlertDescription>
        <p className="font-medium">{t.status.nextStep}</p>
        <p className="mt-1 font-medium">{t.status.bookingNotConnected}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span>{profile.planName}</span>
          <Badge variant="secondary">{profile.planMockLabel}</Badge>
        </p>
        <p className="mt-2">{t.status.keepOpen}</p>
      </AlertDescription>
    </Alert>
  );
}
