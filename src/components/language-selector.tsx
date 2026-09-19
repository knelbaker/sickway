"use client";

import { cn } from "cn";
import { useEffect } from "react";
import { useLanguage } from "@/lib/client/language-store";
import { LANGUAGES } from "@/lib/i18n/messages";

/**
 * Visible on every screen, before and during intake. Each language is named in
 * that language, and nothing is inferred about the person. Switching re-renders
 * text only: it cannot submit, clear a draft, or change consent.
 */
export function LanguageSelector() {
  const { language, t, setLanguage } = useLanguage();

  // Assistive technology and the browser need the page language; English-only regions set lang="en" themselves.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div role="radiogroup" aria-label={`${t.languageSelector} / Language`} className="inline-flex items-center rounded-full bg-ink/8 p-0.5">
      {LANGUAGES.map((option) => {
        const checked = option.code === language;
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={checked}
            lang={option.code}
            onClick={() => setLanguage(option.code)}
            className={cn(
              "min-h-11 cursor-pointer rounded-full px-3.5 text-sm font-semibold transition-colors duration-200 sm:px-4",
              checked ? "bg-ink text-paper" : "text-ink-soft hover:text-ink",
            )}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}
