"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { demoSessionResponseSchema } from "@/lib/api-contracts";
import { useLanguage } from "@/lib/client/language-store";
import { apiFetch, setSessionToken, useSessionToken, useSupersededByToken } from "@/lib/client/session-store";

/**
 * "Reset demo" in the header of every screen. It always asks first, so it
 * cannot be hit by accident mid-demo. The student and clinician screens are
 * keyed by session ID, so switching tokens clears drafts, consent, selections,
 * the open encounter, audio, and polled data in one step.
 */
/** `tab` renders the icon-over-label form used in the phone tab bar. */
export function ResetDemoButton({ tab = false }: { tab?: boolean }) {
  const token = useSessionToken();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!token) return null;

  async function reset() {
    setPending(true);
    setFailed(false);
    try {
      const response = await apiFetch("/api/demo-session/reset", { method: "POST" });
      if (!response.ok) throw new Error();
      setSessionToken(demoSessionResponseSchema.parse(await response.json()).token);
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {tab ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[0.6875rem] leading-4 font-semibold text-ink"
        >
          <RotateCcw aria-hidden className="size-5" />
          {t.reset.button}
        </button>
      ) : (
        <Button variant="ghost" onClick={() => setOpen(true)}>
          {t.reset.button}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.reset.title}</DialogTitle>
            <DialogDescription>
              {t.reset.body}
            </DialogDescription>
          </DialogHeader>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t.reset.failed}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-11" disabled={pending} onClick={() => setOpen(false)}>
              {t.reset.keep}
            </Button>
            <Button className="h-11" disabled={pending} onClick={() => void reset()}>
              {pending ? t.reset.pending : t.reset.button}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Shown on the paired device after the other one reset: one tap follows to the new session. */
export function SessionSupersededNotice() {
  const joinToken = useSupersededByToken();
  const { t } = useLanguage();
  if (!joinToken) return null;

  return (
    <Alert className="mb-6" aria-live="assertive">
      <AlertTitle>{t.reset.supersededTitle}</AlertTitle>
      <AlertDescription>
        <p>{t.reset.supersededBody}</p>
        <div className="mt-3">
          <Button className="h-11" onClick={() => setSessionToken(joinToken)}>
            {t.reset.join}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
