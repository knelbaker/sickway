import { NoticeEquivalent } from "@/components/notice-equivalent";

export function SyntheticBanner() {
  return (
    <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-950">
      <span lang="en">Synthetic demo patient — fictional profile and access data.</span>
      <NoticeEquivalent notice="banner" className="mt-0.5 block font-normal" />
    </div>
  );
}
