import { Badge } from "@/components/ui/badge";
import type { SbarSource } from "@/lib/schemas";

/** The same wording on the student and clinician screens, so every brief's origin is labelled (§10). */
export const BRIEF_SOURCE_LABEL: Record<SbarSource, string> = {
  generated: "Generated from the reviewed intake",
  deterministic: "Deterministic summary — assembled without the model",
  prepared_fixture: "Prepared fixture output",
};

export function BriefSourceBadge({ source }: { source: SbarSource }) {
  return <Badge variant={source === "generated" ? "default" : "secondary"}>{BRIEF_SOURCE_LABEL[source]}</Badge>;
}
