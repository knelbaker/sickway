import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMockDollars } from "@/lib/format";
import type { OptionRow } from "@/lib/schemas";

function Mock({ children = "Mock" }: { children?: React.ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>;
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
  return (
    <Table>
      <TableCaption>
        Synthetic demo options for the fictional plan. All costs, coverage, and stock are mock data,
        not verified. The clinician chooses; this table does not recommend.
      </TableCaption>
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
              {renderSelect && <TableCell>{renderSelect(row)}</TableCell>}
              <TableHead scope="row" className="font-medium whitespace-normal">
                <span className="flex flex-col gap-1">
                  {row.therapyName}
                  <Badge variant={row.generic ? "default" : "outline"}>{row.generic ? "Generic" : "Brand"}</Badge>
                </span>
              </TableHead>
              <TableCell className="whitespace-normal">{row.pharmacyName}</TableCell>
              <TableCell>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{formatMockDollars(row.estimatedCost)}</span>
                  <Mock>Mock cost</Mock>
                  {row.exceedsCostCeiling && costCeiling !== null && (
                    <Badge variant="destructive">Above {formatMockDollars(costCeiling)} fictional ceiling</Badge>
                  )}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap items-center gap-1.5">
                  {row.coverageStatus} · {row.formularyTier}
                  <Mock>Mock coverage — not verified</Mock>
                </span>
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap items-center gap-1.5">
                  {row.stockStatus}
                  <Mock>Mock stock</Mock>
                </span>
              </TableCell>
              <TableCell>
                {row.hasManufacturerResources ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pendingTherapyId === row.therapyId}
                    aria-label={`Show manufacturer resources for ${row.therapyName}`}
                    onClick={() => onShowResources(row.therapyId)}
                  >
                    {unlocked ? "Show again" : "Show manufacturer resources"}
                  </Button>
                ) : (
                  <span className="text-muted-foreground">None in demo</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
