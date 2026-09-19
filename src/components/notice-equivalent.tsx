"use client";

import { useLanguage } from "@/lib/client/language-store";

/**
 * The required English banner and disclaimer always stay on screen, word for
 * word. When the interface is in another language, this adds the reviewed
 * equivalent directly underneath, so the notice is understood, not just present.
 */
export function NoticeEquivalent({ notice, className }: { notice: "banner" | "disclaimer"; className?: string }) {
  const { language, t } = useLanguage();
  const text = notice === "banner" ? t.bannerEquivalent : t.disclaimerEquivalent;
  if (!text) return null;
  return (
    <span lang={language} className={className}>
      {text}
    </span>
  );
}
