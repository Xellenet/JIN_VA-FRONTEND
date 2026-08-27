import Link from "next/link"
import { Droplet, Hammer, LayoutGrid, Paintbrush, Scissors, Sparkles, Trees, Zap } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Reveal } from "@/components/public/reveal"

/**
 * Service categories — design-spec.md §3.5.
 *
 * The PRD §1 list, in PRD order, spelling checked: Electrical, Plumbing,
 * Carpentry, Painting, Cleaning, Landscaping, Beauty — then one tile carrying
 * PRD §1's "and more".
 *
 * STATIC by decision (requirements.md Open Question 3): this is the marketing
 * message, it can't break, and it is what lets `/` render with the backend down
 * (LP2). The seeded backend catalogue genuinely differs — it has Tiling and Hair
 * Braiding and no generic "Beauty" — so reading it live would make the page and
 * the PRD visibly disagree.
 *
 * Icons rather than photos: `public/` has no photo for Beauty, Landscaping or
 * Electrical, and one photo tile beside seven icon tiles reads as a rendering
 * fault. Every glyph below exists in the pinned lucide-react ^0.454.0.
 *
 * The whole tile is the click target and every tile goes to `/signup` — there is
 * no public artisan browse route (LP6). No dead clicks.
 */
const CATEGORIES = [
  { name: "Electrical", icon: Zap, examples: "Wiring, rewires, faults" },
  { name: "Plumbing", icon: Droplet, examples: "Leaks, pipes, water heaters" },
  { name: "Carpentry", icon: Hammer, examples: "Fittings, repairs, joinery" },
  { name: "Painting", icon: Paintbrush, examples: "Interiors, exteriors, touch-ups" },
  { name: "Cleaning", icon: Sparkles, examples: "Homes, offices, post-build" },
  { name: "Landscaping", icon: Trees, examples: "Gardens, grounds, clearing" },
  { name: "Beauty", icon: Scissors, examples: "Hair, nails, makeup" },
  { name: "…and every other trade", icon: LayoutGrid, examples: "Tiling, welding, masonry and more" },
] as const

export function ServiceCategories() {
  return (
    <section id="services" className="scroll-mt-20 bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Every trade, one platform.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            JinVa covers all artisan service categories &mdash; if someone does it as a trade, it belongs
            here.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((category, index) => (
            <Reveal asChild delay={index * 60} key={category.name}>
              <Link
                href="/signup"
                className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Card className="h-full gap-3 px-5 py-5 transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-md motion-safe:group-hover:scale-105">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <category.icon className="size-5" aria-hidden="true" />
                  </span>
                  {/* Labels must not truncate mid-word (§7) — no truncate, no line-clamp */}
                  <h3 className="text-base font-semibold text-card-foreground">{category.name}</h3>
                  {/* text-sm, not the spec's text-xs: 14px is the floor for
                      anything a visitor is meant to read. The tile has the room. */}
                  <p className="text-sm leading-relaxed text-muted-foreground">{category.examples}</p>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
