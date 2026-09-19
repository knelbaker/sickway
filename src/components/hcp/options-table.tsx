"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMediaQuery } from "@/lib/client/use-media-query";
import { formatMockDollars } from "@/lib/format";
import type { OptionRow } from "@/lib/schemas";

function Mock({ children = "Mock" }: { children?: React.ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>;
}

function Cost({ row, costCeiling }: { row: OptionRow; costCeiling: number | null }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="font-medium">{formatMockDollars(row.estimatedCost)}</span>
      <Mock>Mock cost</Mock>
      {row.exceedsCostCeiling && costCeiling !== null && (
        <Badge variant="destructive">Above {formatMockDollars(costCeiling)} fictional ceiling</Badge>
      )}
    </span>
  );
}

function Coverage({ row }: { row: OptionRow }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.coverageStatus} · {row.formularyTier}
      <Mock>Mock coverage — not verified</Mock>
    </span>
  );
}

function Stock({ row }: { row: OptionRow }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.stockStatus}
      <Mock>Mock stock</Mock>
    </span>
  );
}

const CAPTION =
  "Synthetic demo options for the fictional plan. All costs, coverage, and stock are mock data, not verified. The clinician chooses; this list does not recommend.";

function ResourcesControl({
  row,
  unlocked,
  pending,
  onShow,
}: {
  row: OptionRow;
  unlocked: boolean;
  pending: boolean;
  onShow: (therapyId: string) => void;
}) {
  if (!row.hasManufacturerResources) return <span className="text-muted-foreground">None in demo</span>;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={`Show manufacturer resources for ${row.therapyName}`}
      onClick={() => onShow(row.therapyId)}
    >
      {unlocked ? "Show again" : "Show manufacturer resources"}
    </Button>
  );
}

/**
 * Generic-first fixture options. Every cost, coverage, and stock value has its
 * mock label in the same cell, not in a footnote or tooltip (§7.3, §11).
 */
export function OptionsTable({
  rows,
  costCeiling,
  unlockedTherapyIds,
  pendingTherapyId,
  onShowResources,
  renderSelect,
}: {
  rows: OptionRow[];
  costCeiling: number | null;
  unlockedTherapyIds: string[];
  pendingTherapyId: string | null;
  onShowResources: (therapyId: string) => void;
  /** Optional selection control per row, supplied by the attach flow. */
  renderSelect?: (row: OptionRow) => React.ReactNode;
}) {
  const wide = useMediaQuery("(min-width: 768px)", true);

  if (!wide) {
    return (
      <div className="flex flex-col gap-3">
        <ul aria-label="Demo options" className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={`${row.therapyId}/${row.pharmacyId}`} className="rounded-lg border p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-medium">{row.therapyName}</span>
                <Badge variant={row.generic ? "default" : "outline"}>{row.generic ? "Generic" : "Brand"}</Badge>
              </div>
              <dl className="flex flex-col gap-2">
                {(
                  [
                    ["Pharmacy", row.pharmacyName],
                    ["Estimated cost", <Cost key="cost" row={row} costCeiling={costCeiling} />],
                    ["Coverage", <Coverage key="coverage" row={row} />],
                    ["Stock", <Stock key="stock" row={row} />],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Manufacturer resources</dt>
                  <dd>
                    <ResourcesControl
                      row={row}
                      unlocked={unlockedTherapyIds.includes(row.therapyId)}
                      pending={pendingTherapyId === row.therapyId}
                      onShow={onShowResources}
                    />
                  </dd>
                </div>
              </dl>
              {renderSelect && (
                <label className="mt-2 flex min-h-11 items-center gap-3 border-t pt-2 font-medium">
                  {renderSelect(row)} Select this option
                </label>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs leading-5 text-muted-foreground">{CAPTION}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableCaption>{CAPTION}</TableCaption>
      <TableHeader>
        <TableRow>
          {renderSelect && <TableHead scope="col">Select</TableHead>}
          <TableHead scope="col">Demo therapy</TableHead>
          <TableHead scope="col">Pharmacy</TableHead>
          <TableHead scope="col">Estimated cost</TableHead>
          <TableHead scope="col">Coverage</TableHead>
          <TableHead scope="col">Stock</TableHead>
          <TableHead scope="col">Manufacturer resources</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const unlocked = unlockedTherapyIds.includes(row.therapyId);
          return (
            <TableRow key={`${row.therapyId}/${row.pharmacyId}`}>
              {renderSelect && (
                <TableCell>
                  <label className="flex size-11 items-center justify-center">{renderSelect(row)}</label>
                </TableCell>
              )}
              <TableHead scope="row" className="font-medium whitespace-normal">
                <span className="flex flex-col gap-1">
                  {row.therapyName}
                  <Badge variant={row.generic ? "default" : "outline"}>{row.generic ? "Generic" : "Brand"}</Badge>
                </span>
              </TableHead>
              <TableCell className="whitespace-normal">{row.pharmacyName}</TableCell>
              <TableCell>
                <Cost row={row} costCeiling={costCeiling} />
              </TableCell>
              <TableCell>
                <Coverage row={row} />
              </TableCell>
              <TableCell>
                <Stock row={row} />
              </TableCell>
              <TableCell>
                <ResourcesControl row={row} unlocked={unlocked} pending={pendingTherapyId === row.therapyId} onShow={onShowResources} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
