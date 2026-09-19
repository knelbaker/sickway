import { Badge } from "@/components/ui/badge";
import { formatIsoWallTime, formatMockDollars } from "@/lib/format";

export type StudentProfileSummary = {
  name: string;
  age: number;
  planName: string;
  planMockLabel: string;
  instructionLanguages: string[];
  costCeiling: number | null;
  fixtureClock: string;
};

const LANGUAGE_NAMES: Record<string, string> = { en: "English", es: "Spanish" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-44 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}

function ProfileSource() {
  return <Badge variant="outline">Source: synthetic profile</Badge>;
}

/** Profile fields come from the loaded fixture, never from what the student types (§6.1). */
export function ProfileSummary({ profile }: { profile: StudentProfileSummary }) {
  return (
    <section aria-labelledby="profile-heading" className="rounded-lg border bg-muted/30 p-4">
      <h2 id="profile-heading" className="mb-3 text-sm font-semibold">
        Synthetic demo patient
      </h2>
      <dl className="flex flex-col gap-2 text-sm">
        <Row label="Name and age">
          {profile.name}, {profile.age} <ProfileSource />
        </Row>
        <Row label="Plan">
          {profile.planName} <Badge variant="secondary">{profile.planMockLabel}</Badge> <ProfileSource />
        </Row>
        <Row label="Instruction languages">
          {profile.instructionLanguages.map((code) => LANGUAGE_NAMES[code] ?? code).join(" and ")}{" "}
          <ProfileSource />
        </Row>
        <Row label="Cost ceiling">
          {profile.costCeiling === null ? "not set" : formatMockDollars(profile.costCeiling)}{" "}
          <Badge variant="secondary">Fictional amount</Badge> <ProfileSource />
        </Row>
        <Row label="Fixture clock">
          {formatIsoWallTime(profile.fixtureClock)} <Badge variant="outline">Source: demo fixture</Badge>
        </Row>
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        The demo uses this displayed clock, not the real time, so “yesterday morning” always means
        the same thing.
      </p>
    </section>
  );
}
