"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { SessionPanel } from "@/components/session/session-panel";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { closeDemoMenu, getDemoMenu, setDemoMenu, useDemoMenu } from "@/lib/client/demo-menu-store";
import { useLanguage } from "@/lib/client/language-store";
import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 220;

/**
 * Starting a session and pairing the second device, kept out of the page and one
 * gesture away. On a wide screen it is a navbar button whose panel opens on hover,
 * and also on click and keyboard focus, since hover alone cannot be used on a touch
 * screen or a keyboard. A click pins it open. On a narrow screen the same panel is
 * a bottom sheet, opened from the page's own buttons.
 */
export function DemoMenu({ wide }: { wide: boolean }) {
  const { t } = useLanguage();
  const state = useDemoMenu();
  const open = state !== "closed";
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (!open || !wide) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && closeDemoMenu();
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) closeDemoMenu();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, wide]);

  useEffect(() => cancelClose, []);

  if (!wide) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && closeDemoMenu()}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-[2rem] bg-paper px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="px-0">
            <SheetTitle className="display text-2xl">{t.landing.startTitle}</SheetTitle>
            <SheetDescription className="sr-only">{t.home.startHelp}</SheetDescription>
          </SheetHeader>
          <SessionPanel />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        cancelClose();
        if (getDemoMenu() === "closed") setDemoMenu("hover");
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        cancelClose();
        // The pointer crosses a small gap between the button and its panel; give it time to arrive.
        timer.current = setTimeout(() => getDemoMenu() === "hover" && closeDemoMenu(), CLOSE_DELAY_MS);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="demo-menu"
        onClick={() => setDemoMenu(state === "pinned" ? "closed" : "pinned")}
        className={cn(
          "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-brand-red-ink px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-ink",
          open && "bg-ink",
        )}
      >
        {t.nav.demo}
        <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="demo-menu"
            role="dialog"
            aria-label={t.landing.startTitle}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            // Opaque: it opens over the headline and the devices, and its own text has to stay readable.
            className="absolute top-full right-0 z-50 mt-3 w-[27rem] origin-top-right rounded-[1.75rem] border border-ink/10 bg-[#fffdf6] p-6 text-left shadow-[0_28px_60px_-12px_rgba(60,40,0,0.32)]"
          >
            <h2 className="display mb-3 text-2xl">{t.landing.startTitle}</h2>
            <SessionPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
