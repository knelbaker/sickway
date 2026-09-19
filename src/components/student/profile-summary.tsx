"use client";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/client/language-store";
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-44 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}

function ProfileSource() {
  const { t } = useLanguage();
  return <Badge variant="outline">{t.common.sourceProfile}</Badge>;
}

/** Profile fields come from the loaded fixture, never from what the student types (§6.1). */
export function ProfileSummary({ profile }: { profile: StudentProfileSummary }) {
  const { language, t } = useLanguage();
  return (
    <section aria-labelledby="profile-heading" className="rounded-lg border bg-muted/30 p-4">
      <h2 id="profile-heading" className="mb-3 text-sm font-semibold">
        {t.profile.title}
      </h2>
      <dl className="flex flex-col gap-2 text-sm">
        <Row label={t.profile.nameAge}>
          {profile.name}, {profile.age} <ProfileSource />
        </Row>
        <Row label={t.profile.plan}>
          {profile.planName} <Badge variant="secondary">{profile.planMockLabel}</Badge> <ProfileSource />
        </Row>
        <Row label={t.profile.languages}>
          {profile.instructionLanguages.map((code) => t.common.languageNames[code] ?? code).join(` ${t.common.and} `)}{" "}
          <ProfileSource />
        </Row>
        <Row label={t.profile.costCeiling}>
          {profile.costCeiling === null ? t.profile.notSet : formatMockDollars(profile.costCeiling)}{" "}
          <Badge variant="secondary">{t.profile.fictionalAmount}</Badge> <ProfileSource />
        </Row>
        <Row label={t.profile.fixtureClock}>
          {formatIsoWallTime(profile.fixtureClock, language)} <Badge variant="outline">{t.common.sourceFixture}</Badge>
        </Row>
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {t.profile.clockNote}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{t.profile.explain}</p>
    </section>
  );
}
