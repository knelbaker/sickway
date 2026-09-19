"use client";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/client/language-store";
import type { SbarSource } from "@/lib/schemas";

/** The same wording on the student and clinician screens, so every brief's origin is labelled (§10). */
export const BRIEF_SOURCE_LABEL: Record<SbarSource, string> = {
  generated: "Generated from the reviewed intake",
  deterministic: "Deterministic summary — assembled without the model",
  prepared_fixture: "Prepared fixture output",
};

/** `localized` is for the student screen; the clinician workspace stays in English. */
export function BriefSourceBadge({ source, localized = false }: { source: SbarSource; localized?: boolean }) {
  const { t } = useLanguage();
  const label = localized ? t.briefSource[source] : BRIEF_SOURCE_LABEL[source];
  return <Badge variant={source === "generated" ? "default" : "secondary"}>{label}</Badge>;
}
