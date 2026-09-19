import { cn } from "@/lib/utils";

/**
 * The sickway mark: a person resting in bed, drawn as one red line. It is an SVG
 * so it stays crisp at any size and can be drawn on (the landing page animates
 * its stroke). The original artwork is kept at public/brand/sickway-logo.png.
 */
export function SickwayMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 66 38"
      fill="none"
      stroke="var(--brand-red)"
      strokeWidth={2.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("h-7 w-auto", className)}
    >
      {/* headboard post and left leg */}
      <path d="M4 6v29" />
      {/* mattress line, rounded corner, right leg */}
      <path d="M4 27h55q3.4 0 3.4 3.4V35" />
      {/* head: a ring with a small resting smile */}
      <circle cx="19.5" cy="14.5" r="7.8" />
      <circle cx="19.5" cy="14.5" r="3.7" />
      <path d="M17.6 15.2q2 1.5 3.9-.6" strokeWidth={1.7} />
      {/* blanket: shoulder rise, long slope to the feet */}
      <path d="M27.4 15.6c1.2 1.9 2.6.4 5.4-.7 5-2 9.4-.8 13.4 2.2 3.8 2.8 7.3 2.6 10.4 3.4 3.1.9 3.9 3.4 2.6 6.5" />
    </svg>
  );
}

/** Mark plus wordmark. The wordmark is live text in the display face, so it scales and translates cleanly. */
export function SickwayLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span lang="en" className={cn("inline-flex items-center gap-2", className)}>
      <SickwayMark className={markClassName} />
      <span className="display text-[1.7rem] leading-none">sickway</span>
    </span>
  );
}
