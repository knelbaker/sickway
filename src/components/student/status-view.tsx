import Link from "next/link";
import type { StudentProfileSummary } from "@/components/student/profile-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  if (status === "packet_available" && packetId) {
    return (
      <Alert aria-live="polite">
        <AlertTitle>Your demo packet is ready</AlertTitle>
        <AlertDescription>
          <p>The demo clinic attached a packet for you. It is available in this demo only.</p>
          <p className="mt-1 font-medium">Booking not connected.</p>
          <div className="mt-3">
            <Button className="h-11" asChild>
              <Link href={`/packet/${encodeURIComponent(packetId)}`}>Open demo packet</Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "emergency") {
    return (
      <Alert variant="destructive" aria-live="assertive">
        <AlertTitle>This demo stops here</AlertTitle>
        <AlertDescription>
          <p>
            You answered yes to an item on this prototype&apos;s emergency checklist, so the routine
            demo flow is bypassed and no clinic next step is shown.
          </p>
          <p className="mt-2">
            In a real situation, call 911 or your campus emergency number. This message is prototype
            copy, not a validated medical screening result.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "needs_review") {
    return (
      <Alert aria-live="polite">
        <AlertTitle>Shared — needs review</AlertTitle>
        <AlertDescription>
          <p>
            Some checklist items were not answered or need a second look, so the demo clinic will
            review your intake before any next step. This is not an all-clear.
          </p>
          <p className="mt-2 font-medium">Booking not connected.</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert aria-live="polite">
      <AlertTitle>Shared with the demo clinic</AlertTitle>
      <AlertDescription>
        <p className="font-medium">Demo next step: campus clinic</p>
        <p className="mt-1 font-medium">Booking not connected.</p>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span>{profile.planName}</span>
          <Badge variant="secondary">{profile.planMockLabel}</Badge>
        </p>
        <p className="mt-2">Keep this screen open. A packet from the demo clinic will appear here.</p>
      </AlertDescription>
    </Alert>
  );
}
