"use client";

import { ChevronDown } from "lucide-react";
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

/**
 * Profile fields come from the loaded fixture, never from what the student types (§6.1).
 *
 * It opens as one line (who the made-up patient is, with the plan's mock label) so the
 * question the student came to answer is the first thing under the stepper, even on a
 * phone. Everything else is one tap away, and nothing is removed.
 */
export function ProfileSummary({ profile }: { profile: StudentProfileSummary }) {
  const { language, t } = useLanguage();
  return (
    <section aria-labelledby="profile-heading">
      <details className="group rounded-2xl border border-ink/12 bg-paper/70">
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <h2 id="profile-heading" className="font-semibold">
            {t.profile.title}
          </h2>
          {/* Name and age live here only; the plan keeps its mock label beside it, in the details. */}
          <span className="flex flex-wrap items-center gap-2 text-ink-soft">
            <span className="sr-only">{t.profile.nameAge}: </span>
            {profile.name}, {profile.age} <ProfileSource />
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
            {t.profile.details}
            <ChevronDown aria-hidden className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
          </span>
        </summary>
        <div className="border-t border-ink/10 px-4 pt-3 pb-4">
      <dl className="flex flex-col gap-2 text-sm">
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
        </div>
      </details>
    </section>
  );
}
