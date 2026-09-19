import { describe, expect, it } from "vitest";
import { buildOptionRows } from "@/lib/options";
import { describeOptions, describeResources, findOptionRow, PROPOSED_MESSAGE } from "@/lib/voice-tools";

const rows = buildOptionRows();
const copay = { id: "resource-demo-copay", therapyId: "therapy-brand-demo", type: "copay_card" as const, title: "Fictional Demo Copay Card", description: "Static sample only.", mockLabel: "Manufacturer resource — fictional demo" as const };

describe("describeOptions", () => {
  it("labels every spoken cost, coverage, and stock value as mock, and tells the agent not to recommend", () => {
    const text = describeOptions({ kind: "rows", rows });

    expect(text.match(/mock cost \d+ dollars/g)).toHaveLength(rows.length);
    expect(text.match(/mock coverage, not verified/g)).toHaveLength(rows.length);
    expect(text.match(/mock stock/g)).toHaveLength(rows.length);
    expect(text).toContain('1. Therapy "Fictional Generic Antiviral Demo", a generic, at pharmacy "Fictional Demo Pharmacy A": mock cost 12 dollars');
    expect(text).toContain("above the patient's fictional cost ceiling");
    expect(text).toContain("Manufacturer resources are still locked");
    expect(text).toContain("Do not recommend an option");
  });

  it("never reveals resource content", () => {
    expect(describeOptions({ kind: "rows", rows })).not.toMatch(/copay|educational/i);
  });

  it("says nothing was found without inventing a match", () => {
    expect(describeOptions({ kind: "not_found" })).toContain("No demo option found");
  });
});

describe("describeResources", () => {
  it("relays the server's reason when resources stay locked", () => {
    expect(describeResources({ kind: "locked", reason: "A category request does not unlock manufacturer resources." })).toBe(
      "Manufacturer resources remain locked. Reason from the server: A category request does not unlock manufacturer resources.",
    );
  });

  it("names the one therapy and calls the resources fictional", () => {
    const text = describeResources({ kind: "unlocked", therapyName: "Fictional Brand Antiviral Demo", resources: [copay] });

    expect(text).toContain("Unlocked for Fictional Brand Antiviral Demo only");
    expect(text).toContain("fictional demo manufacturer resource: Fictional Demo Copay Card");
    expect(text).toContain("Nothing was sent to any manufacturer");
  });
});

describe("findOptionRow", () => {
  it("finds a row despite speech-to-text spacing, case, and punctuation", () => {
    expect(findOptionRow(rows, "fictional generic anti viral demo", "Fictional demo pharmacy A.")).toMatchObject({
      therapyId: "therapy-generic-demo",
      pharmacyId: "pharmacy-demo-a",
    });
  });

  it("accepts extra words around a full name, as the live agent sent them", () => {
    expect(findOptionRow(rows, "Fictional Generic Antiviral Demo (generic)", "the Fictional Demo Pharmacy A")).toMatchObject({
      therapyId: "therapy-generic-demo",
      pharmacyId: "pharmacy-demo-a",
    });
  });

  it.each([
    ["the generic", "Fictional Demo Pharmacy A"],
    ["Fictional Generic Antiviral Demo", "the cheap one"],
    ["", ""],
  ])("returns null for the vague pair %j / %j rather than guessing", (therapy, pharmacy) => {
    expect(findOptionRow(rows, therapy, pharmacy)).toBeNull();
  });
});

describe("PROPOSED_MESSAGE", () => {
  it("tells the agent nothing was attached and only the clinician can confirm", () => {
    expect(PROPOSED_MESSAGE).toContain("Nothing has been attached");
    expect(PROPOSED_MESSAGE).toContain("Only the clinician can attach");
  });
});
