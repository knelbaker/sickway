"use client";

import Link from "next/link";
import { SickwayMark } from "@/components/brand/sickway-logo";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/client/language-store";
import type { EncounterStatus } from "@/lib/schemas";

/**
 * The packet is a ticket, so the step that waits for it and then receives it is ticket-shaped too:
 * a stub on top, a perforation, and a tear-off below. It keeps the alert role the plain version had.
 */
function Ticket({ stub, tearOff, waiting = false }: { stub: React.ReactNode; tearOff: React.ReactNode; waiting?: boolean }) {
  return (
    <div role="alert" aria-live="polite" className="ticket text-sm">
      <div className="ticket-top flex flex-col gap-3 rounded-b-[1.5rem] bg-[#fffdf6] px-5 pt-9 pb-6 sm:px-7">{stub}</div>
      <div className={`relative rounded-[1.5rem] px-5 py-5 sm:px-7 ${waiting ? "bg-[#fffdf6]/60" : "bg-[#fffdf6]"}`}>
        <span aria-hidden className="absolute inset-x-6 top-0 border-t-2 border-dashed border-ink/25" />
        {tearOff}
      </div>
    </div>
  );
}

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
      <Ticket
        stub={
          <>
            <SickwayMark className="h-7 self-start" />
            <h2 className="display text-2xl sm:text-3xl">{t.status.packetTitle}</h2>
            <p className="leading-6 text-ink-soft">{t.status.packetBody}</p>
            <p className="font-medium">{t.status.bookingNotConnected}</p>
          </>
        }
        tearOff={
          <Button variant="brand" className="min-h-12 w-full px-7 text-base sm:w-auto" asChild>
            <Link href={`/packet/${encodeURIComponent(packetId)}`}>{t.status.openPacket}</Link>
          </Button>
        }
      />
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
    <Ticket
      waiting
      stub={
        <>
          <h2 className="display text-2xl sm:text-3xl">{t.status.readyTitle}</h2>
          <p className="font-medium">{t.status.nextStep}</p>
          <p className="font-medium">{t.status.bookingNotConnected}</p>
          <p className="flex flex-wrap items-center gap-2">
            <span>{profile.planName}</span>
            <Badge variant="secondary">{profile.planMockLabel}</Badge>
          </p>
        </>
      }
      tearOff={
        <div className="flex gap-3">
          <span aria-hidden className="mt-1.5 size-2.5 shrink-0 animate-pulse rounded-full bg-brand-red" />
          <div className="flex flex-col gap-1.5 leading-6">
            <p className="font-medium">{t.status.keepOpen}</p>
            <p className="text-ink-soft">{t.status.waitingHow}</p>
          </div>
        </div>
      }
    />
  );
}
