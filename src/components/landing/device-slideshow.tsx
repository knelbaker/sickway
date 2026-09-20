"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Iphone } from "@/components/ui/iphone";
import { Safari } from "@/components/ui/safari";
import { useLanguage } from "@/lib/client/language-store";
import { cn } from "@/lib/utils";

type Slide = { kind: "laptop" | "phone"; src: string; caption: string };

const SWIPE_PX = 60;

/**
 * The hero's two devices, one at a time: the clinician's laptop first, then the student's phone.
 * Showing one at a time lets each be large. The stage keeps the laptop's proportions for both
 * slides, so nothing jumps when the slide changes. It moves only when asked: arrow buttons, or a
 * swipe on a touch screen. The dots show position and are not controls, which keeps every
 * control at a full-size touch target.
 */
export function DeviceSlideshow({ slides }: { slides: Slide[] }) {
  const { t } = useLanguage();
  const copy = t.landing.slideshow;
  const [[index, direction], setState] = useState<[number, 1 | -1]>([0, 1]);
  const slide = slides[index];

  const go = (step: 1 | -1) => setState(([current]) => [(current + step + slides.length) % slides.length, step]);

  return (
    <section aria-roledescription="carousel" aria-label={copy.label} className="flex flex-col gap-5">
      <div className="relative aspect-[1203/753] w-full">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.figure
            key={slide.kind}
            role="group"
            aria-roledescription="slide"
            aria-label={copy.position(index + 1, slides.length)}
            custom={direction}
            variants={{
              enter: (from: 1 | -1) => ({ opacity: 0, x: 40 * from }),
              center: { opacity: 1, x: 0 },
              exit: (from: 1 | -1) => ({ opacity: 0, x: -40 * from }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: "easeOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_event, info) => {
              if (info.offset.x <= -SWIPE_PX) go(1);
              else if (info.offset.x >= SWIPE_PX) go(-1);
            }}
            className="absolute inset-0 flex cursor-grab items-center justify-center active:cursor-grabbing"
          >
            {slide.kind === "laptop" ? (
              <Safari url="sickway.app/hcp" imageSrc={slide.src} className="pointer-events-none h-auto w-full drop-shadow-[0_30px_40px_rgba(60,40,0,0.22)]" />
            ) : (
              // The phone is as tall as the stage; its width follows from the frame's own proportions.
              <Iphone src={slide.src} className="pointer-events-none !w-auto h-full drop-shadow-[0_24px_30px_rgba(60,40,0,0.3)]" />
            )}
            <figcaption className="sr-only">{slide.caption}</figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>

      {/* The caption has its own line: inside the track it wrapped to five lines on a narrow phone in Spanish.
          It is the live region, so each change is announced. */}
      <p aria-live="polite" className="-mt-1 text-center text-sm text-ink-soft">
        {slide.caption}
      </p>

      <div className="flex items-center gap-3">
        <ArrowButton label={copy.previous} onClick={() => go(-1)}>
          <ArrowLeft aria-hidden className="size-5" />
        </ArrowButton>

        <span aria-hidden className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink/8 px-5">
          {slides.map((item, position) => (
            <motion.span
              key={item.kind}
              animate={{ width: position === index ? 28 : 6 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={cn("h-1.5 rounded-full", position === index ? "bg-brand-red" : "bg-ink/30")}
            />
          ))}
        </span>

        <ArrowButton label={copy.next} onClick={() => go(1)}>
          <ArrowRight aria-hidden className="size-5" />
        </ArrowButton>
      </div>
    </section>
  );
}

function ArrowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink text-paper transition-colors duration-200 outline-none hover:bg-brand-red-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
    >
      {children}
    </button>
  );
}
