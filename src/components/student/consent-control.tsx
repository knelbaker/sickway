"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * Separate, explicit consent (§3 Scene 1 step 4, §6.1). Starts unchecked, is
 * never bundled into Submit, and only the student's own tap can set it. The
 * server checks it again before anything becomes visible to the clinic.
 */
export function ConsentControl({
  consent,
  onConsentChange,
  onSubmit,
  onDecline,
  pending,
}: {
  consent: boolean;
  onConsentChange: (consent: boolean) => void;
  onSubmit: () => void;
  onDecline: () => void;
  pending: boolean;
}) {
  return (
    <section aria-labelledby="consent-heading" className="flex flex-col gap-3 rounded-lg border-2 p-4">
      <h2 id="consent-heading" className="text-base font-semibold">
        Share with the demo clinic?
      </h2>
      <div className="flex items-start gap-3">
        <Checkbox
          id="consent"
          className="mt-0.5 size-5"
          checked={consent}
          disabled={pending}
          onCheckedChange={(checked) => onConsentChange(checked === true)}
        />
        <Label htmlFor="consent" className="text-sm leading-6 font-normal">
          I agree to share this synthetic intake with the demo clinic in this demo session.
        </Label>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        If you decline, your intake stays on this screen and the clinic sees nothing. Nothing is
        booked, prescribed, or sent anywhere outside this demo either way.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11" disabled={!consent || pending} onClick={onSubmit}>
          {pending ? "Sharing…" : "Submit to demo clinic"}
        </Button>
        <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={onDecline}>
          Decline
        </Button>
      </div>
    </section>
  );
}
