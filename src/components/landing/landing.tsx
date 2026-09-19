"use client";

import { Check, CircleHelp, RotateCcw, SquareCheckBig, SquareDashed } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SickwayMark } from "@/components/brand/sickway-logo";
import { SessionPanel } from "@/components/session/session-panel";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { DotPattern } from "@/components/ui/dot-pattern";
import { Iphone } from "@/components/ui/iphone";
import { Safari } from "@/components/ui/safari";
import { useLanguage } from "@/lib/client/language-store";
import { useMediaQuery } from "@/lib/client/use-media-query";
import { cn } from "@/lib/utils";

const PROMISE_ICONS = [CircleHelp, SquareCheckBig, SquareDashed, RotateCcw];

/** Real screenshots of this app, regenerated with `pnpm shots:brand`. */
const SHOTS = {
  student: "/brand/shot-student.png",
  clinician: "/brand/shot-clinician.png",
  packet: "/brand/shot-packet.png",
};

export function Landing() {
  const { language, t } = useLanguage();
  const copy = t.landing;

  return (
    <MotionConfig reducedMotion="user">
    <div lang={language} className="flex flex-col gap-24 pb-8 sm:gap-36">
      <Hero />
      <Showcase />

      <section aria-labelledby="real-title">
        <BlurFade inView>
          <h2 id="real-title" className="display max-w-[16ch] text-4xl sm:text-6xl">
            {copy.realTitle}
          </h2>
          <p className="mt-5 max-w-[62ch] text-lg leading-8 text-ink-soft">{copy.realIntro}</p>
        </BlurFade>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <BlurFade inView delay={0.05}>
            <div className="glass h-full rounded-[2rem] p-6 sm:p-9">
              <h3 className="display text-2xl sm:text-3xl">{copy.realHeading}</h3>
              <ul className="mt-6 flex flex-col gap-4">
                {copy.real.map((line) => (
                  <li key={line} className="flex gap-3 leading-7">
                    <Check aria-hidden className="mt-1 size-5 shrink-0 text-brand-red" strokeWidth={3} />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </BlurFade>
          <BlurFade inView delay={0.15}>
            <div className="h-full rounded-[2rem] border-2 border-dashed border-ink-soft/70 p-6 sm:p-9">
              <h3 className="display text-2xl sm:text-3xl">{copy.mockHeading}</h3>
              <ul className="mt-6 flex flex-col gap-4">
                {copy.mock.map((line) => (
                  <li key={line} className="flex gap-3 leading-7">
                    <SquareDashed aria-hidden className="mt-1 size-5 shrink-0 text-ink-soft" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </BlurFade>
        </div>
        <p className="mt-6 max-w-[70ch] leading-7 text-ink-soft">{copy.notBuilt}</p>
      </section>

      <section aria-labelledby="promises-title">
        <BlurFade inView>
          <h2 id="promises-title" className="display max-w-[16ch] text-4xl sm:text-6xl">
            {copy.promisesTitle}
          </h2>
        </BlurFade>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {copy.promises.map((promise, index) => {
            const Icon = PROMISE_ICONS[index];
            return (
              <BlurFade key={promise.title} inView delay={0.05 * index}>
                <div className="glass flex h-full gap-4 rounded-[1.75rem] p-6">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold">{promise.title}</h3>
                    <p className="mt-1.5 max-w-[46ch] leading-7 text-ink-soft">{promise.body}</p>
                  </div>
                </div>
              </BlurFade>
            );
          })}
        </div>
      </section>

      <footer className="flex flex-col gap-4 border-t border-ink/10 pt-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <span lang="en" className="inline-flex items-center gap-3">
          <SickwayMark className="h-8" />
          <span>sickway, built at VTHacks 14</span>
        </span>
        <span>{copy.honest}</span>
      </footer>
    </div>
    </MotionConfig>
  );
}

function Hero() {
  const { t } = useLanguage();
  const copy = t.landing;

  return (
    <section className="grid items-center gap-14 pt-4 lg:grid-cols-[1fr_1fr] lg:gap-10 lg:pt-10">
      <div className="flex flex-col gap-7">
        <BlurFade delay={0.05}>
          <h1 className="display text-[clamp(3rem,8.2vw,6rem)]">{copy.headline}</h1>
        </BlurFade>
        <BlurFade delay={0.15}>
          <p className="max-w-[54ch] text-lg leading-8 sm:text-xl sm:leading-9">{copy.sub}</p>
          <p className="mt-4 max-w-[54ch] border-l-[3px] border-dashed border-ink-soft pl-4 leading-7 text-ink-soft">
            {copy.honest}
          </p>
        </BlurFade>
        <BlurFade delay={0.25}>
          <div className="flex flex-col gap-3 pt-2">
            <h2 className="display text-2xl sm:text-3xl">{copy.startTitle}</h2>
            <SessionPanel />
          </div>
        </BlurFade>
      </div>

      <BlurFade delay={0.3} className="relative mx-auto w-full max-w-xl pb-10 lg:max-w-none">
        <figure className="ml-auto w-[90%]">
          <Safari url="sickway.app/hcp" imageSrc={SHOTS.clinician} className="h-auto w-full drop-shadow-[0_30px_40px_rgba(60,40,0,0.22)]" />
          <figcaption className="mt-3 text-right text-sm text-ink-soft">{copy.laptopCaption}</figcaption>
        </figure>
        <figure className="absolute bottom-0 left-0 w-[32%] min-w-28">
          <Iphone src={SHOTS.student} className="h-auto w-full drop-shadow-[0_24px_30px_rgba(60,40,0,0.3)]" />
          <figcaption className="mt-3 text-sm text-ink-soft">{copy.phoneCaption}</figcaption>
        </figure>
      </BlurFade>
    </section>
  );
}

/**
 * The signature moment. On a wide screen a glass stage stays pinned while the
 * three steps scroll past, and its device swaps to a real screenshot of that
 * step; the logo's red line slides to whichever step is active. On a phone each
 * step simply carries its own screenshot.
 */
function Showcase() {
  const { t } = useLanguage();
  const copy = t.landing;
  const wide = useMediaQuery("(min-width: 1024px)", true);
  const [active, setActive] = useState(0);
  const captions = [copy.phoneCaption, copy.laptopCaption, copy.packetCaption];

  return (
    <section aria-labelledby="journey-title">
      <BlurFade inView>
        <h2 id="journey-title" className="display max-w-[14ch] text-4xl sm:text-6xl">
          {copy.journeyTitle}
        </h2>
      </BlurFade>

      <div className="mt-10 grid gap-10 lg:mt-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <ol className="flex flex-col gap-16 lg:gap-0">
          {copy.steps.map((step, index) => (
            <Step key={step.where} index={index} active={wide && active === index} onActive={setActive} tall={wide}>
              <span aria-hidden className="display text-xl text-brand-red-ink">
                {index + 1}
              </span>
              <h3 className="display mt-1 text-3xl sm:text-4xl">{step.where}</h3>
              <p className="mt-4 max-w-[52ch] text-lg leading-8 text-ink-soft">{step.what}</p>
              {!wide && (
                <figure className="mt-8">
                  <Device index={index} className="mx-auto" />
                  <figcaption className="mt-3 text-center text-sm text-ink-soft">{captions[index]}</figcaption>
                </figure>
              )}
            </Step>
          ))}
        </ol>

        {wide && (
          <div className="relative">
            <div className="glass sticky top-40 flex h-[min(70vh,44rem)] items-center justify-center overflow-hidden rounded-[2.5rem] p-8">
              <DotPattern width={20} height={20} cr={1} className="text-ink/15 [mask-image:radial-gradient(closest-side,black,transparent)]" />
              <AnimatePresence mode="wait">
                <motion.figure
                  key={active}
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="relative flex h-full w-full flex-col items-center justify-center gap-4"
                >
                  <Device index={active} className="max-h-[calc(100%-2.5rem)]" />
                  <figcaption className="text-sm text-ink-soft">{captions[active]}</figcaption>
                </motion.figure>
              </AnimatePresence>
              <BorderBeam size={160} duration={10} colorFrom="#ee121d" colorTo="#ee121d" borderWidth={2} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Device({ index, className }: { index: number; className?: string }) {
  if (index === 1) {
    return <Safari url="sickway.app/hcp" imageSrc={SHOTS.clinician} className={cn("h-auto w-full max-w-2xl drop-shadow-[0_24px_32px_rgba(60,40,0,0.2)]", className)} />;
  }
  return (
    <Iphone
      src={index === 0 ? SHOTS.student : SHOTS.packet}
      className={cn("h-auto w-56 max-w-full drop-shadow-[0_24px_32px_rgba(60,40,0,0.28)] lg:h-full lg:w-auto", className)}
    />
  );
}

function Step({
  index,
  active,
  tall,
  onActive,
  children,
}: {
  index: number;
  active: boolean;
  tall: boolean;
  onActive: (index: number) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);

  // The step nearest the middle of the screen is the active one.
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && onActive(index), {
      rootMargin: "-45% 0px -45% 0px",
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [index, onActive]);

  return (
    <li ref={ref} className={cn("relative pl-6 sm:pl-8", tall && "flex min-h-[70vh] flex-col justify-center")}>
      <span aria-hidden className="absolute top-0 bottom-0 left-0 w-[3px] rounded-full bg-ink/10" />
      {active && (
        <motion.span
          aria-hidden
          layoutId="sickway-thread"
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="absolute top-[38%] bottom-[38%] left-0 w-[3px] rounded-full bg-brand-red"
        />
      )}
      <div className={cn("transition-opacity duration-300", tall && !active && "opacity-40")}>{children}</div>
    </li>
  );
}
