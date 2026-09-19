import { SessionGate } from "@/components/session/session-gate";
import { StudentFlow } from "@/components/student/student-flow";
import { fixtures } from "@/lib/fixtures";
import { voiceAvailability } from "@/lib/voice-server";

export default function StudentPage() {
  const { profile, plans } = fixtures;
  const plan = plans.find((row) => row.id === profile.planId);

  // Only the profile summary crosses to the browser; catalogs and resources stay on the server.
  return (
    <SessionGate screen="student">
      <StudentFlow
        voiceEnabled={voiceAvailability().studentDictation}
        preparedIntake={profile.intake}
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
