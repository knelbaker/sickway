import { NoticeEquivalent } from "@/components/notice-equivalent";
import { cn } from "@/lib/utils";

/**
 * The required disclaimer, word for word in English, with the reviewed
 * equivalent underneath when the interface is in another language. Every
 * screen keeps it: the layout prints it under the page content, and the
 * landing page also carries it beside its "synthetic demo" note.
 */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("leading-5", className)}>
      <span lang="en">Prototype workflow. Not medical advice. Do not enter real health information.</span>
      <NoticeEquivalent notice="disclaimer" className="block" />
    </p>
  );
}
