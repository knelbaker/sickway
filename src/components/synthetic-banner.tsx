import { NoticeEquivalent } from "@/components/notice-equivalent";

/**
 * Required on every screen and never dismissible. It is the top of the sticky
 * frame (see layout.tsx), so it stays in view while the page scrolls, and it
 * clears the iOS notch.
 */
export function SyntheticBanner() {
  return (
    <div className="bg-ink px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-center text-[0.8125rem] leading-5 font-medium text-paper">
      <span lang="en">Synthetic demo patient — fictional profile and access data.</span>
      <NoticeEquivalent notice="banner" className="block font-normal text-paper/80" />
    </div>
  );
}
