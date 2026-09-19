"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useElementWidth } from "@/lib/client/use-element-width";
import { useMediaQuery } from "@/lib/client/use-media-query";
import { formatMockDollars } from "@/lib/format";
import type { OptionRow } from "@/lib/schemas";
import { useLanguage } from "@/lib/client/language-store";

function Mock({ children }: { children: React.ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>;
}

/** Fixture values (names, coverage and stock statuses) are English data, shown as written. */
function Data({ children }: { children: React.ReactNode }) {
  return <span lang="en">{children}</span>;
}

function Cost({ row, costCeiling }: { row: OptionRow; costCeiling: number | null }) {
  const o = useLanguage().t.clinician.options;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="font-medium">{formatMockDollars(row.estimatedCost)}</span>
      <Mock>{o.mockCost}</Mock>
      {row.exceedsCostCeiling && costCeiling !== null && (
        <Badge variant="destructive">{o.aboveCeiling(formatMockDollars(costCeiling))}</Badge>
      )}
    </span>
  );
}

function Coverage({ row }: { row: OptionRow }) {
  const o = useLanguage().t.clinician.options;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Data>
        {row.coverageStatus} · {row.formularyTier}
      </Data>
      <Mock>{o.mockCoverage}</Mock>
    </span>
  );
}

function Stock({ row }: { row: OptionRow }) {
  const o = useLanguage().t.clinician.options;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Data>{row.stockStatus}</Data>
      <Mock>{o.mockStock}</Mock>
    </span>
  );
}

/** Seven columns, each with its mock label beside the value, need about this much room. */
const TABLE_MIN_WIDTH = 900;

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
  const o = useLanguage().t.clinician.options;
  if (!row.hasManufacturerResources) return <span className="text-muted-foreground">{o.noneInDemo}</span>;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={o.showResourcesFor(row.therapyName)}
      onClick={() => onShow(row.therapyId)}
    >
      {unlocked ? o.showAgain : o.showResources}
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
  const o = useLanguage().t.clinician.options;
  const windowWide = useMediaQuery("(min-width: 768px)", true);
  // The table sits in a column, so the window's width says little. Measure the room it really has;
  // until that is known (or where it cannot be measured) the window decides.
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const wide = windowWide && (width === null || width >= TABLE_MIN_WIDTH);

  if (!wide) {
    return (
      <div ref={ref} className="@container flex flex-col gap-3">
        <ul aria-label={o.list} className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
          {rows.map((row) => (
            <li key={`${row.therapyId}/${row.pharmacyId}`} className="flex flex-col rounded-2xl border border-ink/12 bg-paper/70 p-4 text-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span lang="en" className="font-medium">{row.therapyName}</span>
                <Badge variant={row.generic ? "default" : "outline"}>{row.generic ? o.generic : o.brand}</Badge>
              </div>
              <dl className="mb-3 flex flex-col gap-2">
                {(
                  [
                    [o.pharmacy, <Data key="pharmacy">{row.pharmacyName}</Data>],
                    [o.cost, <Cost key="cost" row={row} costCeiling={costCeiling} />],
                    [o.coverage, <Coverage key="coverage" row={row} />],
                    [o.stock, <Stock key="stock" row={row} />],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">{o.resources}</dt>
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
                <label className="mt-auto flex min-h-11 cursor-pointer items-center gap-3 border-t border-ink/10 pt-2 font-medium">
                  {renderSelect(row)} {o.selectThis}
                </label>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs leading-5 text-muted-foreground">{o.caption}</p>
      </div>
    );
  }

  return (
    <div ref={ref}>
    <Table>
      <TableCaption>{o.caption}</TableCaption>
      <TableHeader>
        <TableRow>
          {renderSelect && <TableHead scope="col">{o.select}</TableHead>}
          <TableHead scope="col">{o.therapy}</TableHead>
          <TableHead scope="col">{o.pharmacy}</TableHead>
          <TableHead scope="col">{o.cost}</TableHead>
          <TableHead scope="col">{o.coverage}</TableHead>
          <TableHead scope="col">{o.stock}</TableHead>
          <TableHead scope="col">{o.resources}</TableHead>
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
                  <Data>{row.therapyName}</Data>
                  <Badge variant={row.generic ? "default" : "outline"}>{row.generic ? o.generic : o.brand}</Badge>
                </span>
              </TableHead>
              <TableCell className="whitespace-normal"><Data>{row.pharmacyName}</Data></TableCell>
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
    </div>
  );
}
