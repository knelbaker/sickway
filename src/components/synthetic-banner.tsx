import { NoticeEquivalent } from "@/components/notice-equivalent";

/**
 * Required on every screen and never dismissible. It is the top of the sticky
 * frame (see layout.tsx), so it stays in view while the page scrolls, and it
 * clears the iOS notch.
 *
 * On a phone it is a slim frosted strip in the page's own cream, so the small
 * screen is not headed by a heavy black bar; from 640px up it is the black bar.
 * The sentence is the same, word for word, at every width.
 */
export function SyntheticBanner() {
  return (
    <div className="bg-paper/85 px-4 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1 text-center text-xs leading-4 font-medium text-ink-soft backdrop-blur-md sm:bg-ink sm:pt-[max(0.5rem,env(safe-area-inset-top))] sm:pb-2 sm:text-[0.8125rem] sm:leading-5 sm:text-paper sm:backdrop-blur-none">
      <span lang="en">Synthetic demo patient — fictional profile and access data.</span>
      <NoticeEquivalent notice="banner" className="block font-normal sm:text-paper/80" />
    </div>
  );
}
