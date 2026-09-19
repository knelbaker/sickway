import type { EncounterStatus } from "@/lib/schemas";

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

export { BRIEF_SOURCE_LABEL } from "@/components/brief-source-badge";

export const FIELD_SOURCE_LABEL: Record<string, string> = {
  synthetic_profile: "synthetic profile",
  student_review: "student review",
  demo_fixture: "demo fixture",
};
