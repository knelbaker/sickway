"use client";

import Link from "next/link";
import { LanguageSelector } from "@/components/language-selector";
import { ResetDemoButton } from "@/components/session/reset-controls";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/client/language-store";

export function SiteHeader() {
  const { t } = useLanguage();

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 sm:px-6">
        <Link href="/" lang="en" className="inline-flex min-h-11 items-center font-semibold tracking-tight">
          Sick Day + Doorway
        </Link>
        <LanguageSelector />
        <nav aria-label="Main navigation" className="flex w-full flex-wrap gap-1 sm:w-auto sm:gap-2">
          <Button variant="ghost" asChild>
            <Link href="/s">{t.nav.student}</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/hcp">{t.nav.clinician}</Link>
          </Button>
          <ResetDemoButton />
        </nav>
      </div>
    </header>
  );
}
