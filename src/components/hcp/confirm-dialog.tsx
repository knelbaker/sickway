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
import { useLanguage } from "@/lib/client/language-store";

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
  const { t } = useLanguage();
  const c = t.clinician.confirm;
  const o = t.clinician.options;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>
            {c.body}
          </DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{o.therapy}</dt>
            <dd lang="en" className="font-medium">{row.therapyName}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{c.pharmacy}</dt>
            <dd lang="en" className="font-medium">{row.pharmacyName}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{o.cost}</dt>
            <dd className="flex flex-wrap items-center gap-1.5 font-medium">
              {formatMockDollars(row.estimatedCost)} <Badge variant="secondary">{o.mockCost}</Badge>
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{o.coverage}</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              <span lang="en">{row.coverageStatus}</span> <Badge variant="secondary">{o.mockCoverage}</Badge>
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{c.instructions}</dt>
            <dd className="font-medium">
              {languages.map((code) => t.clinician.sources.languageNames[code] ?? code).join(` ${t.common.and} `)} — {c.prewritten}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{c.included}</dt>
            <dd>
              {resources.length === 0 ? (
                c.none
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
          {c.nothingSent}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={onCancel}>
            {c.cancel}
          </Button>
          <Button type="button" variant="brand" className="h-11" disabled={pending} onClick={onConfirm}>
            {pending ? c.attaching : c.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
