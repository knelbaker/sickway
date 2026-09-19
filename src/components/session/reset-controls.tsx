"use client";

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
import { apiFetch, setSessionToken, useSessionToken, useSupersededByToken } from "@/lib/client/session-store";

/**
 * "Reset demo" in the header of every screen. It always asks first, so it
 * cannot be hit by accident mid-demo. The student and clinician screens are
 * keyed by session ID, so switching tokens clears drafts, consent, selections,
 * the open encounter, audio, and polled data in one step.
 */
export function ResetDemoButton() {
  const token = useSessionToken();
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
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Reset demo
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the demo?</DialogTitle>
            <DialogDescription>
              This starts a fresh synthetic session. Both screens clear, consent starts unticked, and
              nothing from this run is shown again. The other device will be asked to join the new
              session.
            </DialogDescription>
          </DialogHeader>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              Could not reset. Nothing was changed. Check the connection and try again.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-11" disabled={pending} onClick={() => setOpen(false)}>
              Keep this session
            </Button>
            <Button className="h-11" disabled={pending} onClick={() => void reset()}>
              {pending ? "Resetting…" : "Reset demo"}
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
  if (!joinToken) return null;

  return (
    <Alert className="mb-6" aria-live="assertive">
      <AlertTitle>The demo was reset on the other device</AlertTitle>
      <AlertDescription>
        <p>This screen belongs to the previous run and shows nothing from it any more.</p>
        <div className="mt-3">
          <Button className="h-11" onClick={() => setSessionToken(joinToken)}>
            Join the new session
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
