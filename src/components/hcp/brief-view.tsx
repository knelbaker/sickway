"use client";

import { BriefSourceBadge } from "@/components/brief-source-badge";
import { useLanguage } from "@/lib/client/language-store";
import type { Sbar } from "@/lib/schemas";

// The large letters spell the format's name, SBAR, in every language; the headings beside them are translated.
const SECTIONS = [
  ["situation", "S"],
  ["background", "B"],
  ["assessment", "A"],
  ["recommendation", "R"],
] as const;

/** The brief as visible text, always with its source. Audio controls are passed in by the caller. */
export function BriefView({ sbar, words, children }: { sbar: Sbar; words?: string | null; children?: React.ReactNode }) {
  const { t } = useLanguage();
  const b = t.clinician.brief;
  return (
    <section aria-labelledby="brief-heading" className="rounded-2xl border border-rule bg-paper p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="brief-heading" className="display text-2xl">
          {b.title}
        </h3>
        <BriefSourceBadge source={sbar.source} localized />
      </div>
      {children}
      <dl className="flex flex-col divide-y divide-rule">
        {SECTIONS.map(([key, letter]) => (
          <div key={key} className="grid grid-cols-[2.75rem_1fr] gap-x-3 py-4 first:pt-1 sm:grid-cols-[3.5rem_1fr]">
            <span aria-hidden className="display text-5xl text-brand-red sm:text-6xl">
              {letter}
            </span>
            <div>
              <dt className="text-sm font-bold">{b.sections[key]}</dt>
              {/* The brief is written in English and shown as written. */}
              <dd lang="en" className="mt-1 text-base leading-7">{sbar[key]}</dd>
            </div>
          </div>
        ))}
      </dl>
      {/* The handoff keeps the student's wording next to the summary of it. It may be in another
          language than the brief, so it carries no lang attribute of its own. */}
      {words !== undefined && (
        <figure className="mt-2 rounded-2xl border border-dashed border-ink-soft/70 p-4">
          <figcaption className="text-sm font-bold">{b.wordsTitle}</figcaption>
          {words ? <blockquote className="mt-1.5 leading-7">“{words}”</blockquote> : <p className="mt-1.5 text-muted-foreground">{b.wordsNone}</p>}
          <p role="note" className="mt-2 text-xs leading-5 text-muted-foreground">
            {b.notTranslated}
          </p>
        </figure>
      )}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {b.note}
      </p>
    </section>
  );
}
