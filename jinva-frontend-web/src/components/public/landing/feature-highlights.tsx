import {
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  Images,
  Lock,
  MessageSquare,
  Star,
  Timer,
  TrendingUp,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Reveal } from "@/components/public/reveal"

/**
 * Feature highlights — design-spec.md §3.8. Nine PRD §5 capabilities, which
 * fills the 3x3 grid exactly at `lg`.
 *
 * EXPLICITLY ABSENT AND MUST STAY ABSENT (PRD §10 / LP7): any mention of a
 * native mobile app, real-time chat, a map view, nearby-artisan geolocation,
 * loyalty or rewards, promo codes or discounts, or multi-language support.
 * Feature 8 says "messaging", never "real-time" or "live chat"; feature 3 says
 * "reminders", never "push notifications".
 *
 * These cards are NOT links. Nine cards pointing at the same destination is link
 * spam and a screen-reader hazard.
 */
const FEATURES = [
  {
    icon: BadgeCheck,
    title: "Verified artisan badges",
    body: "An admin checks identity documents before an artisan gets the badge.", // §5.3, §5.13
  },
  {
    icon: Images,
    title: "Portfolio galleries",
    body: "Photos and video of past work, opened full-size in a lightbox.", // §5.4
  },
  {
    icon: CalendarCheck,
    title: "Availability and reminders",
    body: "Book a real slot from the artisan's calendar, with reminders 24 hours and 2 hours before.", // §5.5
  },
  {
    icon: Timer,
    title: "A job timeline both sides can see",
    body: "Every status change, from posted to completed, with who triggered it.", // §5.6
  },
  {
    icon: Lock,
    title: "Payment withheld until completion",
    body: "Funds are held and only released to the artisan once the job is confirmed complete.", // §5.7
  },
  {
    icon: CreditCard,
    title: "Card, mobile money or cash",
    body: "Pay the way you already pay. A receipt is emailed to you either way.", // §5.7
  },
  {
    icon: Star,
    title: "Reviews tied to real jobs",
    body: "Only a client with a completed job can review, and every review carries a Verified Booking badge.", // §5.8
  },
  {
    icon: MessageSquare,
    title: "Messaging scoped to the job",
    body: "A thread opens when the job is accepted and archives when it closes.", // §5.10
  },
  {
    icon: TrendingUp,
    title: "Earnings and ratings analytics",
    body: "Artisans see earnings over time, job counts, rating trend and repeat-client rate.", // §5.12
  },
] as const

export function FeatureHighlights() {
  return (
    <section id="features" className="scroll-mt-20 border-y border-border bg-muted/40">
      <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            What you get, on both sides of the job.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal asChild delay={(index % 3) * 80} key={feature.title}>
              <Card className="h-full gap-3 px-6 py-6 transition-all duration-300 hover:shadow-md motion-safe:hover:-translate-y-0.5">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold text-card-foreground">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
