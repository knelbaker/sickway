"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMockDollars } from "@/lib/format";
import type { ManufacturerResource, OptionRow } from "@/lib/schemas";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", es: "Spanish" };

/** The clinician reviews exactly what will be stored before anything is attached (§5, §7.5). */
export function ConfirmDialog({
  open,
  row,
  languages,
  resources,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  row: OptionRow;
  languages: string[];
  resources: ManufacturerResource[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review packet before attaching</DialogTitle>
          <DialogDescription>
            You chose these demo options. Confirming makes a packet available to the student in this
            demo session only.
          </DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Demo therapy</dt>
            <dd className="font-medium">{row.therapyName}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Fictional pharmacy</dt>
            <dd className="font-medium">{row.pharmacyName}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Estimated cost</dt>
            <dd className="flex flex-wrap items-center gap-1.5 font-medium">
              {formatMockDollars(row.estimatedCost)} <Badge variant="secondary">Mock cost</Badge>
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Coverage</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              {row.coverageStatus} <Badge variant="secondary">Mock coverage — not verified</Badge>
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">Instructions</dt>
            <dd className="font-medium">
              {languages.map((code) => LANGUAGE_NAMES[code] ?? code).join(" and ")} — prewritten demo text
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">Manufacturer resources included</dt>
            <dd>
              {resources.length === 0 ? (
                "None"
              ) : (
                <ul className="flex flex-col gap-1">
                  {resources.map((resource) => (
                    <li key={resource.id} className="flex flex-wrap items-center gap-1.5">
                      {resource.title} <Badge variant="secondary">{resource.mockLabel}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>

        <p className="rounded-md bg-muted p-3 text-sm leading-6">
          Nothing is transmitted to a pharmacy, clinic, insurer, or manufacturer. No prescription is
          written and no appointment is made.
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="brand" className="h-11" disabled={pending} onClick={onConfirm}>
            {pending ? "Attaching…" : "Confirm and attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
