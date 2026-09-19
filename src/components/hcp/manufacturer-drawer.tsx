"use client";

import { LockIcon, LockOpenIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ManufacturerResource } from "@/lib/schemas";
import { useLanguage } from "@/lib/client/language-store";

export type UnlockedResources = Record<string, { therapyName: string; resources: ManufacturerResource[] }>;

/**
 * Locked until the server confirms an explicit, therapy-specific request. This
 * component only reflects what the resources route returned; it holds no unlock
 * logic of its own (§7.4).
 */
export function ManufacturerDrawer({
  unlocked,
  lockedReason,
}: {
  unlocked: UnlockedResources;
  lockedReason: string | null;
}) {
  const d = useLanguage().t.clinician.drawer;
  const therapies = Object.entries(unlocked);

  return (
    <section aria-labelledby="manufacturer-heading" className="rounded-2xl border border-ink/12 bg-paper/70 p-4">
      <h3 id="manufacturer-heading" className="flex items-center gap-2 text-sm font-semibold">
        {therapies.length === 0 ? <LockIcon aria-hidden className="size-4" /> : <LockOpenIcon aria-hidden className="size-4" />}
        {d.title}
      </h3>

      {therapies.length === 0 && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {d.locked}
        </p>
      )}
      {lockedReason && (
        <p role="status" className="mt-2 text-sm leading-6">
          {d.stillLocked} {d.reasons[lockedReason] ?? lockedReason}
        </p>
      )}

      {therapies.map(([therapyId, { therapyName, resources }]) => (
        <div key={therapyId} className="mt-3 border-t pt-3">
          <p className="text-sm font-medium">{d.unlockedFor(therapyName)}</p>
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">{d.none}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {resources.map((resource) => (
                <li key={resource.id} className="rounded-md bg-muted/50 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{resource.title}</span>
                    <Badge variant="secondary">{resource.mockLabel}</Badge>
                  </div>
                  <p className="mt-1 leading-6 text-muted-foreground">{resource.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {d.audit}
      </p>
    </section>
  );
}
