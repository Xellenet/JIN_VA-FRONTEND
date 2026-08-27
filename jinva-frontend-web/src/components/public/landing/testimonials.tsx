import { Info } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { RatingStars } from "@/components/ui/rating-stars"
import { Reveal } from "@/components/public/reveal"

/**
 * PLACEHOLDER CONTENT — NOT REAL JINVA REVIEWS.
 *
 * There is no testimonial data source anywhere in either repo. These quotes,
 * names and roles are invented sample copy whose only job is to show the shape
 * of the section. They must never be presented as real customer feedback, and
 * the section renders a visible "Sample content" badge plus an explanatory line
 * so a reviewer can tell without reading this file (LP8).
 *
 * Real reviews ARE stored (PRD §5.8), so this section could later read them —
 * that is deliberately out of this round's scope. TO REMOVE THE SECTION: empty
 * this array. The whole section, heading and all, then renders nothing.
 *
 * Avatars reuse `public/placeholder-user.jpg`, an asset that already exists; no
 * new stock imagery is committed.
 */
interface PlaceholderTestimonial {
  quote: string
  name: string
  role: string
}

const PLACEHOLDER_TESTIMONIALS: readonly PlaceholderTestimonial[] = [
  {
    quote:
      "I could see the work he'd done before I booked him, and the money only moved once the sink actually drained. That was the whole difference.",
    name: "Sample client",
    role: "Homeowner, Accra",
  },
  {
    quote:
      "My calendar is mine. I take the jobs that fit, and the payout lands without me having to chase anyone for it.",
    name: "Sample artisan",
    role: "Carpenter, Kumasi",
  },
  {
    quote:
      "Having the booking and the payment in one place meant that when something went wrong, there was a record to point at.",
    name: "Sample client",
    role: "Office manager, Takoradi",
  },
]

export function Testimonials() {
  // An orphan heading over an empty dashed box would be worse than either state
  if (PLACEHOLDER_TESTIMONIALS.length === 0) return null

  return (
    <section id="testimonials" className="scroll-mt-20 bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        {/* The dashed edge is the tell — borrowed from the Empty primitive, and
            nothing else on this page has one, so the section reads as
            scaffolding at a glance in both themes. */}
        <Reveal className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/40 p-6">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What clients and artisans say
            </h2>
            <Badge variant="outline" className="shrink-0">
              <Info className="h-3 w-3" aria-hidden="true" />
              Sample content
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Placeholder &mdash; these are not real JinVa reviews. This section will read from real
            completed-job reviews before launch.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PLACEHOLDER_TESTIMONIALS.map((testimonial, index) => (
              <Reveal asChild delay={index * 80} key={testimonial.quote}>
                <Card className="h-full gap-4 px-6 py-6">
                  <RatingStars rating={5} size="sm" showCount={false} />
                  <blockquote className="text-sm leading-relaxed text-card-foreground">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <div className="mt-auto flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarImage src="/placeholder-user.jpg" alt="" />
                      <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                        {testimonial.name
                          .split(" ")
                          .map((word) => word[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-card-foreground">
                        {testimonial.name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
