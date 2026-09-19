"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/client/language-store";

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
  canSubmit = true,
}: {
  consent: boolean;
  onConsentChange: (consent: boolean) => void;
  onSubmit: () => void;
  onDecline: () => void;
  pending: boolean;
  /** False while something required is missing, such as a preferred language. */
  canSubmit?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <section aria-labelledby="consent-heading" className="flex flex-col gap-3 rounded-lg border-2 p-4">
      <h2 id="consent-heading" className="text-base font-semibold">
        {t.consent.title}
      </h2>
      <div className="flex items-center gap-3">
        <Checkbox
          id="consent"
          className="mt-0.5 size-5"
          checked={consent}
          disabled={pending}
          onCheckedChange={(checked) => onConsentChange(checked === true)}
        />
        <Label htmlFor="consent" className="min-h-11 flex-1 items-center text-sm leading-6 font-normal">
          {t.consent.label}
        </Label>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {t.consent.explain} {t.consent.note}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11" disabled={!consent || pending || !canSubmit} onClick={onSubmit}>
          {pending ? t.consent.sharing : t.consent.submit}
        </Button>
        <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={onDecline}>
          {t.consent.decline}
        </Button>
      </div>
    </section>
  );
}
