import { describe, expect, it } from "vitest";
import { fixtures } from "@/lib/fixtures";
import { buildOptionRows, matchOptions, namedTherapyIds } from "@/lib/options";
import { optionRowSchema } from "@/lib/schemas";

const GENERIC = "therapy-generic-demo";
const BRAND = "therapy-brand-demo";

describe("buildOptionRows", () => {
  it("joins every therapy with every pharmacy for the profile's plan", () => {
    const rows = buildOptionRows();

    expect(rows).toHaveLength(fixtures.therapies.length * fixtures.pharmacies.length);
    for (const row of rows) expect(() => optionRowSchema.parse(row)).not.toThrow();
  });

  it("sorts generic entries first, then by mock cost ascending", () => {
    expect(buildOptionRows().map((row) => [row.therapyId, row.pharmacyId, row.estimatedCost])).toEqual([
      [GENERIC, "pharmacy-demo-a", 12],
      [GENERIC, "pharmacy-demo-b", 18],
      [BRAND, "pharmacy-demo-a", 45],
      [BRAND, "pharmacy-demo-b", 55],
    ]);
  });

  it("flags every cost, coverage, and stock value as mock", () => {
    for (const row of buildOptionRows()) {
      expect(row).toMatchObject({ costMock: true, coverageMock: true, stockMock: true });
      expect(row.coverageStatus).toMatch(/mock/i);
      expect(row.stockStatus).toMatch(/mock/i);
    }
  });

  it("marks rows above the profile's cost ceiling", () => {
    const ceiling = fixtures.profile.costCeiling ?? Infinity;

    for (const row of buildOptionRows()) expect(row.exceedsCostCeiling).toBe(row.estimatedCost > ceiling);
    expect(buildOptionRows().some((row) => row.exceedsCostCeiling)).toBe(true);
  });

  it("says whether manufacturer resources exist but never includes their content", () => {
    const rows = buildOptionRows();

    expect(rows.filter((row) => row.therapyId === BRAND).every((row) => row.hasManufacturerResources && row.resourceMock)).toBe(true);
    expect(rows.filter((row) => row.therapyId === GENERIC).every((row) => !row.hasManufacturerResources)).toBe(true);
    const serialized = JSON.stringify(rows);
    for (const resource of fixtures.resources) {
      expect(serialized).not.toContain(resource.id);
      expect(serialized).not.toContain(resource.title);
    }
  });
});

describe("matchOptions", () => {
  it("lists every option for the scripted category question", () => {
    const match = matchOptions("Show the antiviral demo options and sample costs.");

    expect(match.found && match.rows.map((row) => row.generic)).toEqual([true, true, false, false]);
  });

  it("lists only the named therapy when the query names one", () => {
    const match = matchOptions(`what does ${fixtures.therapies[1].name.toUpperCase()} cost?`);

    expect(match.found && new Set(match.rows.map((row) => row.therapyId))).toEqual(new Set([BRAND]));
  });

  it.each(["Show antibiotic options", "what are the options?", "inhaler prices", "   "])(
    "does not fabricate a match for %j",
    (query) => {
      expect(matchOptions(query)).toEqual({ found: false });
    },
  );
});

describe("namedTherapyIds", () => {
  it("finds therapies by their full fixture name only", () => {
    expect(namedTherapyIds(`show resources for ${fixtures.therapies[1].name}`)).toEqual([BRAND]);
    expect(namedTherapyIds("show antiviral options")).toEqual([]);
    expect(namedTherapyIds("the brand one")).toEqual([]);
  });
});
