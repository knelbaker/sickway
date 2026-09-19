"use client";

import { Check, CircleHelp, RotateCcw, SquareCheckBig, SquareDashed } from "lucide-react";
import { AnimatePresence, motion, MotionConfig, useInView } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SickwayMark } from "@/components/brand/sickway-logo";
import { Disclaimer } from "@/components/disclaimer";
import { SessionPanel } from "@/components/session/session-panel";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { DotPattern } from "@/components/ui/dot-pattern";
import FluidOrb from "@/components/ui/fluid-orb";
import FolderComponent from "@/components/ui/folder-component";
import { HookSidebar } from "@/components/ui/hook-sidebar";
import { Iphone } from "@/components/ui/iphone";
import { Safari } from "@/components/ui/safari";
import { StepPlayer } from "@/components/ui/step-player";
import { TaskList } from "@/components/ui/task-list";
import { useLanguage } from "@/lib/client/language-store";
import { useMediaQuery } from "@/lib/client/use-media-query";
import { cn } from "@/lib/utils";

const PROMISE_ICONS = [CircleHelp, SquareCheckBig, SquareDashed, RotateCcw];

/** Real screenshots of this app, regenerated with `pnpm shots:brand`. */
/** Landing sections, in page order; the side rail and scroll position share them. */
const SECTION_IDS = ["start", "journey", "real", "promises", "try"] as const;

function scrollToId(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

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
      <PageRail />
      <Hero />
      <Showcase />

      <section id="real" aria-labelledby="real-title">
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

      <section id="promises" aria-labelledby="promises-title">
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

      <TryIt />
      <Closing />

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
    <section id="start" className="grid items-center gap-14 pt-4 lg:grid-cols-[1fr_1fr] lg:gap-10 lg:pt-10">
      <div className="flex flex-col gap-7">
        <BlurFade delay={0.05}>
          <h1 className="display text-[clamp(3rem,8.2vw,6rem)]">{copy.headline}</h1>
        </BlurFade>
        <BlurFade delay={0.15}>
          <p className="max-w-[54ch] text-lg leading-8 sm:text-xl sm:leading-9">{copy.sub}</p>
          <Disclaimer className="mt-4 border-l-[3px] border-dashed border-ink-soft pl-4 text-sm leading-6 text-ink-soft" />
        </BlurFade>
        <BlurFade delay={0.25}>
          <div className="flex flex-col gap-3 pt-2">
            <h2 className="display text-2xl sm:text-3xl">{copy.startTitle}</h2>
            <SessionPanel />
          </div>
        </BlurFade>
      </div>

      <BlurFade delay={0.3} className="mx-auto w-full max-w-xl lg:max-w-none">
        {/* Two rows shared by both figures, so the devices stand on one line and the captions on another. */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.27fr)] grid-rows-[auto_auto] items-end gap-x-4 gap-y-3 sm:gap-x-7">
          <figure className="row-span-2 grid grid-rows-subgrid">
            <Safari url="sickway.app/hcp" imageSrc={SHOTS.clinician} className="h-auto w-full self-end drop-shadow-[0_30px_40px_rgba(60,40,0,0.22)]" />
            <figcaption className="self-start text-sm text-ink-soft">{copy.laptopCaption}</figcaption>
          </figure>
          <figure className="row-span-2 grid grid-rows-subgrid">
            <Iphone src={SHOTS.student} className="h-auto w-full self-end drop-shadow-[0_24px_30px_rgba(60,40,0,0.3)]" />
            <figcaption className="self-start text-sm text-ink-soft">{copy.phoneCaption}</figcaption>
          </figure>
        </div>
      </BlurFade>

      <Facts />
    </section>
  );
}

/** True facts about the product, never usage numbers. Each rolls up once, when first seen. */
function Facts() {
  const { t } = useLanguage();
  const ref = useRef<HTMLDListElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });

  return (
    <dl ref={ref} className="grid grid-cols-3 gap-4 border-t border-ink/10 pt-8 lg:col-span-2">
      {t.landing.facts.map((fact) => (
        <div key={fact.label} className="flex flex-col-reverse gap-1">
          <dt className="max-w-[22ch] text-sm leading-5 text-ink-soft sm:text-base sm:leading-6">{fact.label}</dt>
          <dd className="display text-5xl leading-none text-ink sm:text-7xl">
            <AnimatedCounter value={seen ? fact.value : 0} duration={0.9} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** "On this page", for screens wide enough to have a margin. Follows the scroll position. */
function PageRail() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          // The closing beat has no rail item of its own; it belongs to the last one.
          const index = SECTION_IDS.indexOf(entry.target.id as (typeof SECTION_IDS)[number]);
          setCurrent(index === -1 ? SECTION_IDS.length - 1 : index);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const id of [...SECTION_IDS, "closing"]) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <HookSidebar
      aria-label={t.landing.onThisPage}
      items={[...t.landing.sections]}
      value={current}
      onChange={(index) => scrollToId(SECTION_IDS[index])}
      color="#ee121d"
      dashed={false}
      className="fixed top-1/2 left-3 z-30 hidden w-32 -translate-y-1/2 min-[1440px]:flex"
    />
  );
}

/** The closing section: what comes back, and a four-move guide to trying the demo. */
function TryIt() {
  const { t } = useLanguage();
  const copy = t.landing;
  const roomy = useMediaQuery("(min-width: 640px)", true);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  // Labels follow the language; only the ticks are state, and they never leave this screen.
  const tasks = copy.tryTasks.map((label, index) => ({ id: String(index), label, done: done.has(String(index)) }));

  return (
    <section id="try" aria-labelledby="try-title" className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <BlurFade inView>
        <h2 id="try-title" className="display max-w-[14ch] text-4xl sm:text-6xl">
          {copy.tryTitle}
        </h2>
        <p className="mt-5 max-w-[56ch] text-lg leading-8 text-ink-soft">{copy.tryIntro}</p>
        <TaskList
          tasks={tasks}
          onTasksChange={(next) => setDone(new Set(next.filter((task) => task.done).map((task) => task.id)))}
          accent="#c8121b"
          size="lg"
          className="mt-8 max-w-xl"
        />
      </BlurFade>

      <BlurFade inView delay={0.1}>
        {/* The top padding is headroom: the cards rise out of the folder when it opens. */}
        <div className="glass flex flex-col items-center rounded-[2.5rem] px-6 pt-24 pb-8 text-center sm:px-10 sm:pt-32">
          <FolderComponent
            color="red"
            size={roomy ? "md" : "sm"}
            labels={[...copy.folderLabels]}
            label={copy.folderOpen}
            className={roomy ? "h-[17rem]" : "h-[11.5rem]"}
          />
          <h3 className="display mt-4 text-2xl sm:text-3xl">{copy.folderTitle}</h3>
          <p className="mt-3 max-w-[48ch] leading-7 text-ink-soft">{copy.folderBody}</p>
          <p className="mt-3 text-sm text-ink-soft">{copy.folderHint}</p>
        </div>
      </BlurFade>
    </section>
  );
}

/** The last beat: the orb alone, with room around it, and one way back to the start. */
function Closing() {
  const { t } = useLanguage();

  return (
    <section id="closing" aria-labelledby="closing-title" className="flex flex-col items-center text-center">
      <BlurFade inView>
        <FluidOrb
          aria-hidden
          size={220}
          color="#ee121d"
          className="mx-auto shadow-[0_36px_70px_-18px_rgba(238,18,29,0.55)]"
        />
      </BlurFade>
      <BlurFade inView delay={0.1}>
        <h2 id="closing-title" className="display mt-10 max-w-[12ch] text-5xl sm:text-7xl">
          {t.landing.headline}
        </h2>
        <Button variant="brand" className="mt-8 min-h-12 px-7 text-base" onClick={() => scrollToId("start")}>
          {t.landing.closingCta}
        </Button>
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
  const [playing, setPlaying] = useState(false);
  const captions = [copy.phoneCaption, copy.laptopCaption, copy.packetCaption];
  const sectionRef = useRef<HTMLElement>(null);
  const onStage = useInView(sectionRef, { amount: 0.2 });

  // The player drives the page: each finished step scrolls the next one into the middle,
  // and the scroll position stays the single source of truth for which step is active.
  const goTo = useCallback((index: number) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`journey-step-${index}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, []);

  return (
    <section ref={sectionRef} id="journey" aria-labelledby="journey-title">
      <BlurFade inView>
        <h2 id="journey-title" className="display max-w-[14ch] text-4xl sm:text-6xl">
          {copy.journeyTitle}
        </h2>
      </BlurFade>

      <div className="mt-10 grid gap-10 lg:mt-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <ol className="flex flex-col gap-16 lg:gap-0">
          {copy.steps.map((step, index) => (
            <Step key={step.where} id={`journey-step-${index}`} index={index} active={wide && active === index} onActive={setActive} tall={wide}>
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
                  <Device index={active} reveal className="max-h-[calc(100%-6.5rem)]" />
                  <figcaption className="text-sm text-ink-soft">{captions[active]}</figcaption>
                </motion.figure>
              </AnimatePresence>
              {/* Remounts per step so the fill restarts when scrolling, not only when playing. */}
              <StepPlayer
                key={active}
                steps={copy.steps.map((step) => ({ label: step.where, duration: 5000 }))}
                value={active}
                onValueChange={goTo}
                playing={playing && onStage}
                onPlayingChange={setPlaying}
                onComplete={() => setPlaying(false)}
                controlPosition="left"
                controlLabels={copy.player}
                className="absolute inset-x-8 bottom-6 z-10"
              />
              <BorderBeam size={160} duration={10} colorFrom="#ee121d" colorTo="#ee121d" borderWidth={2} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Device({ index, reveal, className }: { index: number; reveal?: boolean; className?: string }) {
  if (index === 1) {
    return <Safari url="sickway.app/hcp" imageSrc={SHOTS.clinician} reveal={reveal} className={cn("h-auto w-full max-w-2xl drop-shadow-[0_24px_32px_rgba(60,40,0,0.2)]", className)} />;
  }
  return (
    <Iphone
      src={index === 0 ? SHOTS.student : SHOTS.packet}
      reveal={reveal}
      className={cn("h-auto w-56 max-w-full drop-shadow-[0_24px_32px_rgba(60,40,0,0.28)] lg:h-full lg:w-auto", className)}
    />
  );
}

function Step({
  id,
  index,
  active,
  tall,
  onActive,
  children,
}: {
  id: string;
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
    <li ref={ref} id={id} className={cn("relative pl-6 sm:pl-8", tall && "flex min-h-[70vh] flex-col justify-center")}>
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
