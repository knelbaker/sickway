import { squash } from "@/lib/options";
import type { ManufacturerResource, OptionRow } from "@/lib/schemas";

/**
 * What the clinician voice agent hears back from its client tools. Browser-safe.
 * The agent may only speak costs, coverage, and stock from these strings, and
 * each one already says "mock" (sickway.md §6.2: every spoken cost comes from a
 * labelled tool result).
 */

export type OptionsOutcome = { kind: "rows"; rows: OptionRow[] } | { kind: "not_found" } | { kind: "error" };

export type ResourcesOutcome =
  | { kind: "unlocked"; therapyName: string; resources: ManufacturerResource[] }
  | { kind: "locked"; reason: string }
  | { kind: "error" };

export const USE_TYPED_CONTROLS = "That did not work. The typed controls on screen can be used instead.";

export function describeOptions(outcome: OptionsOutcome): string {
  if (outcome.kind === "error") return USE_TYPED_CONTROLS;
  if (outcome.kind === "not_found") {
    return "No demo option found. This demo only has fixture options for antivirals. Nothing was changed.";
  }
  const rows = outcome.rows.map(
    (row, index) =>
      `${index + 1}. Therapy "${row.therapyName}", a ${row.generic ? "generic" : "brand"}, at pharmacy "${row.pharmacyName}": mock cost ${row.estimatedCost} dollars${row.exceedsCostCeiling ? ", above the patient's fictional cost ceiling" : ""}; mock coverage, not verified: ${row.coverageStatus}; mock stock: ${row.stockStatus}.`,
  );
  return `The options table is now on screen. All values are mock fixture data, not verified. ${rows.join(" ")} Manufacturer resources are still locked. Do not recommend an option; the clinician chooses.`;
}

export function describeResources(outcome: ResourcesOutcome): string {
  if (outcome.kind === "error") return USE_TYPED_CONTROLS;
  if (outcome.kind === "locked") return `Manufacturer resources remain locked. Reason from the server: ${outcome.reason}`;
  if (outcome.resources.length === 0) {
    return `${outcome.therapyName} has no manufacturer resources in this demo. Nothing else was unlocked.`;
  }
  return `Unlocked for ${outcome.therapyName} only, and now on screen. Each is a fictional demo manufacturer resource: ${outcome.resources.map((resource) => resource.title).join("; ")}. The unlock was recorded in the demo audit log. Nothing was sent to any manufacturer.`;
}

/** Speech-to-text and the agent may vary spacing and punctuation; match names the same way the server does. */
export function findOptionRow(rows: OptionRow[], therapyName: string, pharmacyName: string): OptionRow | null {
  const therapy = squash(therapyName);
  const pharmacy = squash(pharmacyName);
  if (!therapy || !pharmacy) return null;
  // The agent may add words around a name ("… (generic)"), so the full fixture name must be
  // contained in what it sent. Still exactly one row, or nothing is selected.
  const matches = rows.filter(
    (row) => therapy.includes(squash(row.therapyName)) && pharmacy.includes(squash(row.pharmacyName)),
  );
  return matches.length === 1 ? matches[0] : null;
}

export const PROPOSED_MESSAGE =
  "The confirmation dialog is open on the clinician's screen. Nothing has been attached. Only the clinician can attach the packet, by reviewing the dialog and pressing Confirm and attach. Do not say it was attached.";
