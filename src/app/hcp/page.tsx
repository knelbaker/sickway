import { ClinicianWorkspace } from "@/components/hcp/clinician-workspace";
import { SessionGate } from "@/components/session/session-gate";
import { fixtures } from "@/lib/fixtures";

export default function ClinicianPage() {
  const { profile, plans } = fixtures;
  const plan = plans.find((row) => row.id === profile.planId);

  // Catalogs and manufacturer resources stay on the server; they reach this screen only through the API.
  return (
    <SessionGate title="Clinician workspace">
      <ClinicianWorkspace
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
