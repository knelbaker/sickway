"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/hcp/confirm-dialog";
import type { UnlockedResources } from "@/components/hcp/manufacturer-drawer";
import { OptionsPanel, type OptionsActions } from "@/components/hcp/options-panel";
import { VoiceControl, type VoiceActions } from "@/components/hcp/voice-control";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { attachResponseSchema } from "@/lib/api-contracts";
import { apiFetch } from "@/lib/client/session-store";
import type { Encounter, InstructionLanguage, OptionRow } from "@/lib/schemas";
import { describeOptions, describeResources, findOptionRow, PROPOSED_MESSAGE, USE_TYPED_CONTROLS } from "@/lib/voice-tools";

const LANGUAGES: { code: InstructionLanguage; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
];

const ATTACH_ERRORS: Record<string, string> = {
  confirmation_required: "Confirmation is required. Nothing was attached.",
  resource_locked: "A selected manufacturer resource is not unlocked for this encounter. Nothing was attached.",
  resource_therapy_mismatch: "A selected resource belongs to a different therapy. Nothing was attached.",
  price_mismatch: "The demo price changed. Reload the options and try again. Nothing was attached.",
  not_available_for_status: "A packet cannot be attached to this encounter.",
  invalid_session: "This demo session has ended. Start or join a session again from the home page.",
  expired_session: "This demo session has ended. Start or join a session again from the home page.",
};

const rowKey = (row: OptionRow) => `${row.therapyId}/${row.pharmacyId}`;

/**
 * Options, then the clinician's own selection, a review, and an explicit
 * confirmation. Nothing is pre-selected and nothing is attached without
 * "Confirm and attach" (§3 Scene 2 steps 4–5).
 */
export function VisitPanel({
  encounter,
  costCeiling,
  preferredLanguages,
  preferenceSource = "profile",
  voiceEnabled = false,
}: {
  encounter: Encounter;
  costCeiling: number | null;
  preferredLanguages: string[];
  /** Whether the defaults are the student's own choice or the profile's displayed selection. */
  preferenceSource?: "student" | "profile";
  /** True only when the server runs with VOICE_MODE=live and a configured agent. */
  voiceEnabled?: boolean;
}) {
  const [rows, setRows] = useState<OptionRow[]>([]);
  const [unlocked, setUnlocked] = useState<UnlockedResources>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [languages, setLanguages] = useState<InstructionLanguage[]>(
    LANGUAGES.map((language) => language.code).filter((code) => preferredLanguages.includes(code)),
  );
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attached, setAttached] = useState(false);

  const canAttach = encounter.status === "ready" || encounter.status === "in_visit";
  const done = attached || encounter.status === "packet_available";
  const selected = rows.find((row) => rowKey(row) === selectedKey) ?? null;
  // Only resources the server unlocked, and only for the chosen therapy, are ever offered.
  const offered = selected ? (unlocked[selected.therapyId]?.resources ?? []) : [];
  const included = offered.filter((resource) => resourceIds.includes(resource.id));

  // The optional voice layer drives these same controls. It can open the confirmation
  // dialog but has no way to confirm: only the on-screen button calls confirm().
  const optionsActions = useRef<OptionsActions | null>(null);
  const latest = useRef({ rows, canAttach, done });
  useEffect(() => {
    latest.current = { rows, canAttach, done };
  });
  const voiceActions = useMemo<VoiceActions>(
    () => ({
      showOptions: async (query) =>
        optionsActions.current ? describeOptions(await optionsActions.current.showOptions(query)) : USE_TYPED_CONTROLS,
      requestResources: async (clinicianWords) =>
        optionsActions.current
          ? describeResources(await optionsActions.current.requestResources(clinicianWords))
          : USE_TYPED_CONTROLS,
      proposePacket: ({ therapyName, pharmacyName, languages: requested }) => {
        const current = latest.current;
        if (current.done) return "This encounter already has a packet. Nothing was changed.";
        if (!current.canAttach) return "A packet cannot be attached to this encounter. Nothing was changed.";
        if (current.rows.length === 0) return "The options are not on screen yet. Call show_options first.";
        const row = findOptionRow(current.rows, therapyName, pharmacyName);
        if (!row) {
          return "That therapy and pharmacy pair is not in the options table. Ask the clinician which row they mean. Nothing was changed.";
        }
        setSelectedKey(rowKey(row));
        setResourceIds([]);
        setLanguages(requested === "en" ? ["en"] : requested === "es" ? ["es"] : ["en", "es"]);
        setError(null);
        setReviewing(true);
        return PROPOSED_MESSAGE;
      },
    }),
    [],
  );

  async function confirm() {
    if (!selected || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/encounters/${encounter.id}/attach`, {
        method: "POST",
        body: JSON.stringify({
          confirmed: true,
          therapyId: selected.therapyId,
          pharmacyId: selected.pharmacyId,
          mockPrice: selected.estimatedCost,
          instructionLanguages: languages,
          resourceIds: included.map((resource) => resource.id),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = (body as { error?: string } | null)?.error ?? "";
        setError(ATTACH_ERRORS[code] ?? "Could not attach the packet. Nothing was changed. Try again.");
        return;
      }
      attachResponseSchema.parse(body);
      setAttached(true);
    } catch {
      setError("Could not attach the packet. Nothing was changed. Try again.");
    } finally {
      setPending(false);
      setReviewing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {voiceEnabled && canAttach && !done && <VoiceControl actions={voiceActions} />}
      <OptionsPanel
        onActions={(actions) => {
          optionsActions.current = actions;
        }}
        encounterId={encounter.id}
        costCeiling={costCeiling}
        unlockedTherapyIds={encounter.unlockedTherapyIds}
        onRows={(next) => {
          setRows(next);
          if (!next.some((row) => rowKey(row) === selectedKey)) setSelectedKey(null);
        }}
        onUnlocked={setUnlocked}
        renderSelect={
          canAttach && !done
            ? (row) => (
                <input
                  type="radio"
                  name={`option-${encounter.id}`}
                  className="size-5"
                  aria-label={`Select ${row.therapyName} at ${row.pharmacyName}`}
                  checked={selectedKey === rowKey(row)}
                  onChange={() => {
                    setSelectedKey(rowKey(row));
                    setResourceIds([]);
                    setError(null);
                  }}
                />
              )
            : undefined
        }
      />

      {done && (
        <Alert aria-live="polite">
          <AlertTitle>Packet available in demo</AlertTitle>
          <AlertDescription>
            The paired student screen can now open it. Nothing was transmitted to a pharmacy or clinic.
          </AlertDescription>
        </Alert>
      )}

      {canAttach && !done && selected && (
        <section aria-labelledby="attach-heading" className="flex flex-col gap-4 rounded-lg border-2 p-4">
          <div>
            <h3 id="attach-heading" className="text-sm font-semibold">
              Packet for the student
            </h3>
            <p className="text-sm text-muted-foreground">
              {selected.therapyName} at {selected.pharmacyName}
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Prewritten demo instructions</legend>
            {LANGUAGES.map((language) => (
              <div key={language.code} className="flex items-center gap-3">
                <Checkbox
                  id={`language-${language.code}`}
                  className="size-5"
                  checked={languages.includes(language.code)}
                  onCheckedChange={(checked) =>
                    setLanguages((current) =>
                      LANGUAGES.map((item) => item.code).filter((code) =>
                        code === language.code ? checked === true : current.includes(code),
                      ),
                    )
                  }
                />
                <Label htmlFor={`language-${language.code}`} className="min-h-11 flex-1 items-center font-normal">
                  {language.name}
                  {preferredLanguages.includes(language.code) && (
                    <span className="text-xs text-muted-foreground">
                      {preferenceSource === "student" ? " — student's preference" : " — profile preference"}
                    </span>
                  )}
                </Label>
              </div>
            ))}
            <p className="text-xs leading-5 text-muted-foreground">
              Static demo copy, not live translation and not clinically validated instructions.
            </p>
          </fieldset>

          {offered.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Include unlocked manufacturer resources (optional)</legend>
              {offered.map((resource) => (
                <div key={resource.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`resource-${resource.id}`}
                    className="size-5"
                    checked={resourceIds.includes(resource.id)}
                    onCheckedChange={(checked) =>
                      setResourceIds((current) =>
                        checked === true ? [...current, resource.id] : current.filter((id) => id !== resource.id),
                      )
                    }
                  />
                  <Label htmlFor={`resource-${resource.id}`} className="min-h-11 flex-1 items-center font-normal">
                    {resource.title}
                  </Label>
                </div>
              ))}
            </fieldset>
          )}

          <div>
            <Button type="button" className="h-11" disabled={languages.length === 0} onClick={() => setReviewing(true)}>
              Review and confirm
            </Button>
            {languages.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Choose at least one instruction language.</p>
            )}
          </div>

          <ConfirmDialog
            open={reviewing}
            row={selected}
            languages={languages}
            resources={included}
            pending={pending}
            onCancel={() => setReviewing(false)}
            onConfirm={() => void confirm()}
          />
        </section>
      )}

      {error && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertTitle>Not attached</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
