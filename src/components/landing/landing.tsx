"use client";

import { Check, CircleHelp, Languages, SquareCheckBig, SquareDashed } from "lucide-react";
import { AnimatePresence, motion, MotionConfig, useInView } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SickwayMark } from "@/components/brand/sickway-logo";
import { DeviceSlideshow } from "@/components/landing/device-slideshow";
import { Disclaimer } from "@/components/disclaimer";
import { RoleLinks, useStartSession } from "@/components/session/session-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { openDemoMenu } from "@/lib/client/demo-menu-store";
import { useLanguage } from "@/lib/client/language-store";
import { useSessionToken } from "@/lib/client/session-store";
import { useMediaQuery } from "@/lib/client/use-media-query";
import { useSafeReducedMotion } from "@/lib/client/use-safe-reduced-motion";
import { cn } from "@/lib/utils";

const PROMISE_ICONS = [CircleHelp, SquareCheckBig, SquareDashed, Languages];

/** Real screenshots of this app, regenerated with `pnpm shots:brand`. */
/** Landing sections, in page order; the side rail and scroll position share them. */
const SECTION_IDS = ["start", "journey", "why", "real", "promises", "try"] as const;

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

      {/* Problem, what the prototype demonstrates, and the hoped-for benefit kept apart from anything measured. */}
      <section id="why" aria-labelledby="why-title">
        <BlurFade inView>
          <h2 id="why-title" className="display max-w-[16ch] text-4xl sm:text-6xl">
            {copy.whyTitle}
          </h2>
        </BlurFade>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {copy.why.map((item, index) => (
            <BlurFade key={item.title} inView delay={0.05 * index}>
              <div className={cn("h-full rounded-[1.75rem] p-6 sm:p-7", index === 2 ? "border-2 border-dashed border-ink-soft/70" : "glass")}>
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="mt-2 leading-7 text-ink-soft">{item.body}</p>
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

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
          <span>Sickway, built at VTHacks 14</span>
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
    // The hero owns the first screen: it is at least as tall as the window below the sticky header,
    // so the next section starts past the fold at any window height, and its content sits centred.
    <section
      id="start"
      // The section grows left by --shift and its gap grows by the same amount, so the text column
      // keeps its width and moves left while the devices stay where they are.
      className="hero-shift grid min-h-[calc(100svh-10rem)] content-center items-center gap-14 pt-4 lg:-ml-[var(--shift)] lg:grid-cols-[1fr_1fr] lg:gap-[calc(2rem+var(--shift))] lg:pt-0"
    >
      <div className="flex flex-col gap-7 squat:gap-4">
        <BlurFade delay={0.05}>
          {/* One sentence in two sizes: the feeling first, then the barrier this project is about. */}
          <h1 className="display text-[clamp(2.75rem,6.4vw,5rem)] squat:text-[3.25rem]">
            {copy.headline}
            <span className="mt-3 block text-[0.5em] leading-[1.08] tracking-[-0.015em] text-ink-soft [word-spacing:0.14em]">{copy.headlineSecond}</span>
          </h1>
        </BlurFade>
        <BlurFade delay={0.15}>
          <p className="max-w-[54ch] text-lg leading-8 sm:text-xl sm:leading-9 squat:text-base squat:leading-7">{copy.sub}</p>
          <div className="mt-4 border-l-[3px] border-dashed border-ink-soft pl-4 text-sm leading-6 text-ink-soft">
            {/* What is supported, stated before the student starts: two languages, and no translation. */}
            <p className="font-medium text-ink">{copy.support}</p>
            <Disclaimer className="leading-6" />
          </div>
        </BlurFade>
        <BlurFade delay={0.25}>
          <HeroActions />
        </BlurFade>
      </div>

      <BlurFade delay={0.3} className="hero-bleed mx-auto w-full max-w-xl lg:mr-[calc(-1*var(--bleed))] lg:ml-0 lg:w-[calc(100%+var(--bleed))] lg:max-w-none">
        <DeviceSlideshow
          slides={[
            { kind: "laptop", src: SHOTS.clinician, caption: copy.laptopCaption },
            { kind: "phone", src: SHOTS.student, caption: copy.phoneCaption },
          ]}
        />
      </BlurFade>
    </section>
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

/**
 * The hero's one row of actions. Pairing details live in the navbar's Demo menu, so the page
 * stays clean: before a session there is a single button, which starts one and then opens that
 * menu on the join link; after, the two screens and a quiet way back to the join link.
 */
function HeroActions() {
  const { t } = useLanguage();
  const token = useSessionToken();
  const { start, pending, error } = useStartSession();

  // Undefined until the browser has read its stored token; hold the row's height so nothing jumps.
  if (token === undefined) return <div aria-hidden className="min-h-12" />;

  if (token === null) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <Button
            variant="brand"
            className="min-h-12 px-7 text-base"
            disabled={pending}
            onClick={async () => {
              if (await start()) openDemoMenu();
            }}
          >
            {pending ? t.home.starting : t.home.start}
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t.home.startFailedTitle}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <RoleLinks />
      <Button variant="ghost" onClick={openDemoMenu}>
        {t.landing.pair}
      </Button>
    </div>
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
        <h2 id="closing-title" className="display mx-auto mt-10 max-w-[16ch] text-4xl sm:text-6xl">
          {t.landing.headline}
          <span className="mt-3 block text-[0.55em] leading-[1.1] tracking-[-0.015em] text-ink-soft [word-spacing:0.14em]">{t.landing.headlineSecond}</span>
        </h2>
        <Button variant="brand" className="mt-8 min-h-12 px-7 text-base" onClick={openDemoMenu}>
          {t.landing.closingCta}
        </Button>
      </BlurFade>
    </section>
  );
}

/** How much scrolling, in viewport heights, each step gets while the story is pinned. */
const STEP_SCROLL_VH = 70;

/**
 * The signature moment. On a wide screen the whole section pins: the heading, the three steps,
 * and the device stage hold still while the page scrolls underneath, and the scroll position
 * moves the story from step 1 to 2 to 3. Only once step 3 has had its turn does the section let
 * go and scroll away. Scroll position is the single source of truth; the player and the step
 * titles just scroll the page to the right place. On a phone each step carries its own screenshot.
 */
function Showcase() {
  const { t } = useLanguage();
  const copy = t.landing;
  const wide = useMediaQuery("(min-width: 1024px)", true);
  const reduced = useSafeReducedMotion();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const captions = [copy.phoneCaption, copy.laptopCaption, copy.packetCaption];
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const onStage = useInView(sectionRef, { amount: 0.2 });
  const count = copy.steps.length;

  // Where the pinned block is within its section: 0 when it has just pinned, 1 when it is about to let go.
  const measure = useCallback(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    if (!section || !pin) return null;
    const rect = section.getBoundingClientRect();
    const stickyTop = parseFloat(getComputedStyle(pin).top) || 0;
    const range = rect.height - pin.offsetHeight;
    return { rect, stickyTop, range };
  }, []);

  useEffect(() => {
    if (!wide) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const m = measure();
      if (!m || m.range <= 0) return;
      const progress = Math.min(1, Math.max(0, (m.stickyTop - m.rect.top) / m.range));
      setActive(Math.min(count - 1, Math.floor(progress * count)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [wide, count, measure]);

  // Scroll the page to the middle of a step's share of the pinned range.
  const goTo = useCallback(
    (index: number) => {
      const m = measure();
      if (!m) return;
      const target = window.scrollY + m.rect.top - m.stickyTop + ((index + 0.5) / count) * m.range;
      window.scrollTo({ top: target, behavior: reduced ? "auto" : "smooth" });
    },
    [count, measure, reduced],
  );

  if (!wide) {
    return (
      <section ref={sectionRef} id="journey" aria-labelledby="journey-title">
        <BlurFade inView>
          <h2 id="journey-title" className="display max-w-[14ch] text-4xl sm:text-6xl">
            {copy.journeyTitle}
          </h2>
        </BlurFade>
        <ol className="mt-10 flex flex-col gap-16">
          {copy.steps.map((step, index) => (
            <li key={step.where} className="relative pl-6 sm:pl-8">
              <span aria-hidden className="absolute top-0 bottom-0 left-0 w-[3px] rounded-full bg-ink/10" />
              <span aria-hidden className="display text-xl text-brand-red-ink">
                {index + 1}
              </span>
              <h3 className="display mt-1 text-3xl sm:text-4xl">{step.where}</h3>
              <p className="mt-4 max-w-[52ch] text-lg leading-8 text-ink-soft">{step.what}</p>
              <figure className="mt-8">
                <Device index={index} className="mx-auto" />
                <figcaption className="mt-3 text-center text-sm text-ink-soft">{captions[index]}</figcaption>
              </figure>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="journey"
      aria-labelledby="journey-title"
      // One pinned screen, plus a stretch of scrolling for each step.
      style={{ height: `calc(100svh - 10.5rem + ${count * STEP_SCROLL_VH}vh)` }}
    >
      <div
        ref={pinRef}
        // One row that fills the pinned screen, so both columns can be full height. The block grows into the
        // empty right margin (--bleed, as the hero's devices do): the panel gets wide without shortening the
        // text's lines. The top padding is small, so the heading sits high and the panel starts level with it.
        className="hero-bleed sticky top-36 grid h-[calc(100svh-10.5rem)] grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] grid-rows-[minmax(0,1fr)] gap-16 pt-[clamp(0.25rem,4vh,3rem)] pb-2 lg:mr-[calc(-1*var(--bleed))] short:pt-[2vh]"
      >
        {/* Anchored from the top, not centred: the steps differ in length, and a centred column
            would nudge the pinned heading every time the step changes. */}
        <div className="flex h-full min-h-0 flex-col">
          <h2 id="journey-title" className="display max-w-[14ch] text-5xl xl:text-6xl short:text-4xl xl:short:text-4xl">
            {copy.journeyTitle}
          </h2>

          {/* The list takes all the height that is left and each step a third of it, so the line runs the
              full height and the three steps are spread along it. Titles sit at the top of their third,
              so they hold still while the current step's description opens beneath. */}
          <ol className="mt-10 flex min-h-0 flex-1 flex-col short:mt-6">
            {copy.steps.map((step, index) => {
              const current = active === index;
              return (
                <li key={step.where} className="relative flex-1 py-5 pl-8 short:py-2">
                  <span aria-hidden className="absolute top-0 bottom-0 left-0 w-[3px] bg-ink/10 first:rounded-t-full" />
                  {current && (
                    <motion.span
                      aria-hidden
                      layoutId="sickway-thread"
                      transition={{ type: "spring", stiffness: 260, damping: 30 }}
                      className="absolute top-4 bottom-4 left-0 w-[3px] rounded-full bg-brand-red short:top-2 short:bottom-2"
                    />
                  )}
                  <button
                    type="button"
                    aria-current={current ? "step" : undefined}
                    onClick={() => goTo(index)}
                    className={cn(
                      "flex min-h-11 w-full cursor-pointer items-baseline gap-3 rounded-lg text-left transition-opacity duration-300 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      !current && "opacity-45 hover:opacity-80",
                    )}
                  >
                    <span aria-hidden className="display text-xl text-brand-red-ink">
                      {index + 1}
                    </span>
                    <h3 className="display text-2xl xl:text-3xl short:text-xl xl:short:text-2xl">{step.where}</h3>
                  </button>
                  {/* Only the current step spells itself out; the others stay as titles so all three fit on one screen. */}
                  {/* Expands with CSS grid rows, not a measured height: animating to height "auto" makes the
                      animation library measure the element and then restore the scroll position, which
                      cancels a smooth scroll that is under way (clicking step 3 used to stop at step 2). */}
                  <div
                    aria-hidden={!current}
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                      current ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-[68ch] pt-2 pb-1 pl-8 text-lg leading-8 text-ink-soft short:pt-1 short:text-base short:leading-7">{step.what}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="glass relative flex h-full max-h-[50rem] min-h-0 flex-col items-center gap-5 overflow-hidden rounded-[2.5rem] p-8">
          <DotPattern width={20} height={20} cr={1} className="text-ink/15 [mask-image:radial-gradient(closest-side,black,transparent)]" />
          <AnimatePresence mode="wait">
            <motion.figure
              key={active}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4"
            >
              <Device index={active} className="max-h-[calc(100%-2.5rem)]" />
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
            className="relative z-10 w-full shrink-0"
          />
          <BorderBeam size={160} duration={10} colorFrom="#ee121d" colorTo="#ee121d" borderWidth={2} />
        </div>
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
