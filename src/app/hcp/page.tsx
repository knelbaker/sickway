import { ClinicianWorkspace } from "@/components/hcp/clinician-workspace";
import { SessionGate } from "@/components/session/session-gate";
import { fixtures } from "@/lib/fixtures";
import { voiceAvailability } from "@/lib/voice-server";

export default function ClinicianPage() {
  const { profile, plans, brief } = fixtures;
  const plan = plans.find((row) => row.id === profile.planId);

  // Catalogs and manufacturer resources stay on the server; they reach this screen only through the API.
  return (
    <SessionGate title="Clinician workspace">
      <ClinicianWorkspace
        voiceEnabled={voiceAvailability().clinicianAgent}
        preparedSpokenScript={brief.sbar.spokenScript}
        profile={{
          name: profile.name,
          age: profile.age,
          planName: plan?.name ?? "Fictional demo plan",
          planMockLabel: plan?.mockLabel ?? "Mock coverage — not verified",
          instructionLanguages: profile.instructionLanguages,
          costCeiling: profile.costCeiling ?? null,
          fixtureClock: profile.fixtureClock,
        }}
      />
    </SessionGate>
  );
}
