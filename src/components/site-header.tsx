"use client";

import { GraduationCap, Stethoscope } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SickwayLogo, SickwayMark } from "@/components/brand/sickway-logo";
import { LanguageSelector } from "@/components/language-selector";
import { DemoMenu } from "@/components/session/demo-menu";
import { ResetDemoButton } from "@/components/session/reset-controls";
import { useLanguage } from "@/lib/client/language-store";
import { useMediaQuery } from "@/lib/client/use-media-query";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/s", key: "student", Icon: GraduationCap },
  { href: "/hcp", key: "clinician", Icon: Stethoscope },
] as const;

/**
 * A floating glass pill that stays with you as the page scrolls. On a wide
 * screen it holds everything. On a phone it keeps the logo and the language
 * choice, and the destinations move to a glass tab bar at the bottom, within
 * thumb reach and clear of the iOS home indicator. Only one of the two navs is
 * ever mounted, so there are no duplicate controls.
 */
export function SiteHeader() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const wide = useMediaQuery("(min-width: 1024px)", true);

  return (
    <>
      <header className="pointer-events-none px-3 pt-3 sm:px-6">
        <div className="glass-strong pointer-events-auto mx-auto flex w-full max-w-4xl items-center justify-between gap-2 rounded-full py-1.5 pr-1.5 pl-4 sm:pl-5">
          <Link href="/" aria-label="sickway — home" className="inline-flex min-h-11 items-center rounded-full">
            <SickwayLogo className="hidden min-[400px]:inline-flex" />
            <SickwayMark className="h-8 min-[400px]:hidden" />
          </Link>

          <div className="flex items-center gap-1.5">
            {wide && (
              <nav aria-label="Main navigation" className="flex items-center gap-0.5">
                {NAV.map(({ href, key }) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors duration-200",
                      pathname === href ? "bg-ink text-paper" : "text-ink hover:bg-ink/8",
                    )}
                  >
                    {t.nav[key]}
                  </Link>
                ))}
                <ResetDemoButton />
              </nav>
            )}
            {wide && <DemoMenu wide />}
            <LanguageSelector />
          </div>
        </div>
      </header>

      {!wide && <DemoMenu wide={false} />}

      {!wide && (
        <nav
          aria-label="Main navigation"
          className="glass-strong pointer-events-auto fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-stretch justify-around rounded-full p-1.5"
        >
          {NAV.map(({ href, key, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[0.6875rem] leading-4 font-semibold transition-colors duration-200",
                pathname === href ? "bg-ink text-paper" : "text-ink",
              )}
            >
              <Icon aria-hidden className="size-5" />
              {t.nav[key]}
            </Link>
          ))}
          <ResetDemoButton tab />
        </nav>
      )}
    </>
  );
}
