import type { EncounterStatus, SbarSource } from "@/lib/schemas";

export const STATUS_LABEL: Record<EncounterStatus, string> = {
  needs_review: "Needs review",
  emergency: "Emergency branch",
  ready: "Ready",
  in_visit: "In visit",
  packet_available: "Packet available in demo",
};

export const STATUS_VARIANT: Record<EncounterStatus, "default" | "secondary" | "destructive" | "outline"> = {
  needs_review: "outline",
  emergency: "destructive",
  ready: "default",
  in_visit: "secondary",
  packet_available: "secondary",
};

/** Shown beside every brief so nothing prepared or assembled is mistaken for live generation (§10). */
export const BRIEF_SOURCE_LABEL: Record<SbarSource, string> = {
  generated: "Generated from the reviewed intake",
  deterministic: "Deterministic summary — assembled without the model",
  prepared_fixture: "Prepared fixture output",
};

export const FIELD_SOURCE_LABEL: Record<string, string> = {
  synthetic_profile: "synthetic profile",
  student_review: "student review",
  demo_fixture: "demo fixture",
};
