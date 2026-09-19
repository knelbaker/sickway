import { fixtures } from "@/lib/fixtures";
import type { OptionRow } from "@/lib/schemas";

/**
 * Mock access options (sickway.md §7.3): a deterministic join of the fixture
 * therapy, plan, and pharmacy catalogs. No model is involved and nothing here
 * can unlock manufacturer resources; rows only say whether resources exist.
 */

/** Words that select the one supported demo category. */
const CATEGORY_WORDS = ["antiviral", "anti-viral", "flu"];

export type OptionsMatch = { found: true; rows: OptionRow[] } | { found: false };

/** Every therapy × pharmacy row for the profile's plan, generic first, then cheapest first. */
export function buildOptionRows(): OptionRow[] {
  const { profile, plans, therapies, pharmacies } = fixtures;
  const plan = plans.find((row) => row.id === profile.planId);
  if (!plan) return [];

  const rows: OptionRow[] = [];
  for (const therapy of therapies) {
    const coverage = plan.formulary.find((row) => row.therapyId === therapy.id);
    if (!coverage) continue;
    for (const pharmacy of pharmacies) {
      const price = pharmacy.prices.find((row) => row.therapyId === therapy.id && row.planId === plan.id);
      if (!price) continue;
      const hasResources = therapy.resourceIds.length > 0;
      rows.push({
        therapyId: therapy.id,
        therapyName: therapy.name,
        generic: therapy.generic,
        formularyTier: coverage.formularyTier,
        coverageStatus: coverage.coverageStatus,
        coverageMock: true,
        estimatedCost: price.estimatedCost,
        costMock: true,
        exceedsCostCeiling: profile.costCeiling !== undefined && price.estimatedCost > profile.costCeiling,
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        stockStatus: price.stockStatus,
        stockMock: true,
        hasManufacturerResources: hasResources,
        ...(hasResources ? { resourceMock: true as const } : {}),
      });
    }
  }

  return rows.sort(
    (a, b) => Number(b.generic) - Number(a.generic) || a.estimatedCost - b.estimatedCost,
  );
}

/** The fixture therapy a text names, if it names exactly one. Shared with the resource gate. */
export function namedTherapyIds(text: string): string[] {
  const lower = text.toLowerCase();
  return fixtures.therapies.filter((therapy) => lower.includes(therapy.name.toLowerCase())).map((therapy) => therapy.id);
}

/**
 * Keyword match against the fixtures. A category query lists every option; a
 * query naming one therapy lists only that therapy. Anything else is not found:
 * a match is never fabricated.
 */
export function matchOptions(query: string): OptionsMatch {
  const lower = query.toLowerCase();
  const named = namedTherapyIds(query);
  const rows = buildOptionRows();

  if (named.length > 0) {
    return { found: true, rows: rows.filter((row) => named.includes(row.therapyId)) };
  }
  if (CATEGORY_WORDS.some((word) => lower.includes(word))) return { found: true, rows };
  return { found: false };
}
