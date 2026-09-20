"use client";

import { useEffect, useRef, useState } from "react";
import { ManufacturerDrawer, type UnlockedResources } from "@/components/hcp/manufacturer-drawer";
import { OptionsTable } from "@/components/hcp/options-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { optionsResponseSchema, resourcesResponseSchema } from "@/lib/api-contracts";
import { apiFetch } from "@/lib/client/session-store";
import type { OptionRow } from "@/lib/schemas";
import type { OptionsOutcome, ResourcesOutcome } from "@/lib/voice-tools";
import { useLanguage } from "@/lib/client/language-store";


type PanelError = "session" | "unavailable" | null;

/** The same actions the typed controls use, for the optional voice layer. */
export type OptionsActions = {
  /** Lists options only; never touches the resources route. */
  showOptions: (query: string) => Promise<OptionsOutcome>;
  /** Sends the clinician's own words to the resources route; the server decides. */
  requestResources: (clinicianWords: string) => Promise<ResourcesOutcome>;
};

/**
 * Typed questions and explicit controls for the mock options (§5 `/hcp`). Every
 * typed question goes to both server routes; whether it lists options or
 * unlocks resources is decided there, never in this component.
 */
export function OptionsPanel({
  encounterId,
  costCeiling,
  unlockedTherapyIds,
  renderSelect,
  onRows,
  onUnlocked,
  onActions,
}: {
  encounterId: string;
  costCeiling: number | null;
  unlockedTherapyIds: string[];
  renderSelect?: (row: OptionRow) => React.ReactNode;
  onRows?: (rows: OptionRow[]) => void;
  onUnlocked?: (unlocked: UnlockedResources) => void;
  onActions?: (actions: OptionsActions | null) => void;
}) {
  const { t } = useLanguage();
  const o = t.clinician.options;
  // The example question is sent to the server as typed. "antiviral" is the word it keys on, in either language.
  const CATEGORY_QUESTION = o.question;
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<OptionRow[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [unlocked, setUnlocked] = useState<UnlockedResources>({});
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingTherapyId, setPendingTherapyId] = useState<string | null>(null);
  const [error, setError] = useState<PanelError>(null);

  const base = `/api/encounters/${encounterId}`;

  function fail(response?: Response) {
    setError(response?.status === 401 ? "session" : "unavailable");
  }

  async function requestResources(
    body: { therapyId: string } | { text: string },
    knownRows: OptionRow[] | null,
  ): Promise<ResourcesOutcome> {
    const response = await apiFetch(`${base}/resources`, { method: "POST", body: JSON.stringify(body) });
    if (!response.ok) {
      fail(response);
      return { kind: "error" };
    }

    const result = resourcesResponseSchema.parse(await response.json());
    if (!result.unlocked) {
      // A plain options question is expected to stay locked; only say so when resources were asked for.
      setLockedReason("therapyId" in body || /resource|manufacturer|co-?pay|card|recurso|fabricante|copago|tarjeta/i.test(body.text) ? result.reason : null);
      return { kind: "locked", reason: result.reason };
    }
    const therapyName = knownRows?.find((row) => row.therapyId === result.therapyId)?.therapyName ?? result.therapyId;
    setLockedReason(null);
    setUnlocked((current) => ({ ...current, [result.therapyId]: { therapyName, resources: result.resources } }));
    return { kind: "unlocked", therapyName, resources: result.resources };
  }

  async function listOptions(question: string): Promise<OptionsOutcome> {
    const response = await apiFetch(`${base}/options`, { method: "POST", body: JSON.stringify({ query: question }) });
    if (!response.ok) {
      fail(response);
      return { kind: "error" };
    }
    const result = optionsResponseSchema.parse(await response.json());
    const nextRows = result.found ? result.rows : null;
    setNotFound(!result.found);
    setRows(nextRows);
    onRows?.(nextRows ?? []);
    return nextRows ? { kind: "rows", rows: nextRows } : { kind: "not_found" };
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setPending(true);
    setError(null);
    try {
      const outcome = await listOptions(question);
      if (outcome.kind === "error") return;
      await requestResources({ text: question }, outcome.kind === "rows" ? outcome.rows : rows);
    } catch {
      fail();
    } finally {
      setPending(false);
    }
  }

  // Tell the parent after the state has settled, never from inside a state updater
  // (that runs during render and must not update another component).
  const onUnlockedRef = useRef(onUnlocked);
  useEffect(() => {
    onUnlockedRef.current = onUnlocked;
  });
  useEffect(() => {
    onUnlockedRef.current?.(unlocked);
  }, [unlocked]);

  // Voice uses exactly these two calls. They always see the latest state through the ref.
  const actionsRef = useRef<OptionsActions | null>(null);
  useEffect(() => {
    actionsRef.current = {
      showOptions: async (query) => {
        setError(null);
        try {
          return await listOptions(query.trim());
        } catch {
          fail();
          return { kind: "error" };
        }
      },
      requestResources: async (clinicianWords) => {
        setError(null);
        try {
          return await requestResources({ text: clinicianWords.trim() }, rows);
        } catch {
          fail();
          return { kind: "error" };
        }
      },
    };
  });
  useEffect(() => {
    onActions?.({
      showOptions: (query) => actionsRef.current?.showOptions(query) ?? Promise.resolve({ kind: "error" }),
      requestResources: (words) => actionsRef.current?.requestResources(words) ?? Promise.resolve({ kind: "error" }),
    });
    return () => onActions?.(null);
    // Registered once; the ref keeps the handlers current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function showResources(therapyId: string) {
    setPendingTherapyId(therapyId);
    setError(null);
    try {
      await requestResources({ therapyId }, rows);
    } catch {
      fail();
    } finally {
      setPendingTherapyId(null);
    }
  }

  return (
    <section aria-labelledby="options-heading" className="flex flex-col gap-4 glass rounded-3xl p-5 sm:p-6">
      <div>
        <h3 id="options-heading" className="display text-xl">
          {o.title}
        </h3>
        <p className="text-xs leading-5 text-muted-foreground">
          {o.body}
        </p>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(query);
        }}
      >
        <Label htmlFor="options-query">{o.askLabel}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="options-query"
            className="h-11"
            value={query}
            maxLength={500}
            placeholder={CATEGORY_QUESTION}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" className="h-11" disabled={pending || query.trim() === ""}>
            {pending ? o.looking : o.ask}
          </Button>
        </div>
        <div>
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => void ask(CATEGORY_QUESTION)}>
            {o.quick}
          </Button>
        </div>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>{error === "session" ? t.clinician.sessionEndedTitle : o.errorTitle}</AlertTitle>
          <AlertDescription>
            {error === "session"
              ? t.clinician.sessionEndedBody
              : o.errorBody}
          </AlertDescription>
        </Alert>
      )}

      {notFound && (
        <Alert>
          <AlertTitle>{o.notFoundTitle}</AlertTitle>
          <AlertDescription>
            {o.notFoundBody(CATEGORY_QUESTION)}
          </AlertDescription>
        </Alert>
      )}

      {rows && rows.length > 0 && (
        <OptionsTable
          rows={rows}
          costCeiling={costCeiling}
          unlockedTherapyIds={[...new Set([...unlockedTherapyIds, ...Object.keys(unlocked)])]}
          pendingTherapyId={pendingTherapyId}
          onShowResources={(therapyId) => void showResources(therapyId)}
          renderSelect={renderSelect}
        />
      )}

      <ManufacturerDrawer unlocked={unlocked} lockedReason={lockedReason} />
    </section>
  );
}
