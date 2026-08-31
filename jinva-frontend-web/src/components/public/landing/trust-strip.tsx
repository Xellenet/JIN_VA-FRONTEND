import { Lock, Scale, ShieldCheck, Star } from "lucide-react"
import { Reveal } from "@/components/public/reveal"

/**
 * Trust strip — design-spec.md §3.4. Short, honest reassurance directly under
 * the hero. Icons plus a few words each, every claim traced to a PRD §5 module.
 *
 * NO NUMBERS in this strip (LP8) — not "10,000+ artisans", not an average
 * rating, not a job count. Nothing here is a statistic.
 */
const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Artisans verified by JinVa" }, // PRD §5.13, §5.3
  { icon: Lock, label: "Payment withheld until you confirm" }, // PRD §5.7
  { icon: Star, label: "Reviews only from completed jobs" }, // PRD §5.8
  { icon: Scale, label: "Disputes reviewed by our team" }, // PRD §5.13
] as const

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-muted/40">
      <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="sr-only">How JinVa protects both sides of a job</h2>
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map((point, index) => (
            <Reveal asChild delay={index * 70} key={point.label}>
              <li className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <point.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-foreground">{point.label}</span>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
