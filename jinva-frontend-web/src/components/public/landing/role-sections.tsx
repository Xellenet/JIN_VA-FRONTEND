import Link from "next/link"
import Image from "next/image"
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Images,
  Info,
  Scale,
  Star,
  TrendingUp,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Reveal } from "@/components/public/reveal"

/**
 * The three role sections — design-spec.md §3.7. One per PRD §4 role. Each
 * headline is that role's PRD §3 objective; each bullet list is its PRD §4 key
 * capabilities, expanded one-for-one. Image/content sides alternate for rhythm.
 *
 * The governance section carries NO CTA of any kind — see below.
 */

function BulletList({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-sm leading-relaxed text-foreground">{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** PRD §4 "Search, book, pay, review, message, dispute", expanded. */
const CLIENT_CAPABILITIES = [
  "Search and filter verified artisans",
  "Book a real time slot",
  "Pay by card, mobile money or cash",
  "Review after completion",
  "Message your artisan about the job",
  "Raise a dispute if it goes wrong",
] as const

/** PRD §4 "Portfolio, calendar, analytics, messaging, payouts", expanded. */
const ARTISAN_CAPABILITIES = [
  "A public profile with a verified badge",
  "Portfolio uploads reviewed before they go live",
  "Payouts to bank or mobile wallet",
  "In-app messaging scoped to each job",
  "A cancellation policy you set",
] as const

const ARTISAN_CARDS = [
  {
    icon: Images,
    title: "Show your work.",
    body: "A portfolio gallery on your public profile.", // §5.4
  },
  {
    icon: CalendarClock,
    title: "Own your calendar.",
    body: "Weekly hours, blocked dates, and a 24-hour window to accept or decline.", // §5.5
  },
  {
    icon: TrendingUp,
    title: "See what's working.",
    body: "Earnings, job counts, rating trend and repeat-client rate.", // §5.12
  },
] as const

/** PRD §4 "User mgmt, moderation, transactions, analytics, disputes". */
const GOVERNANCE_CARDS = [
  {
    icon: BadgeCheck,
    title: "Identity verification",
    body: "Artisans are manually verified before they get the badge.", // §5.13
  },
  {
    icon: ClipboardCheck,
    title: "Portfolio moderation",
    body: "Uploads are reviewed before they appear publicly.", // §5.4, §5.13
  },
  {
    icon: Star,
    title: "Review moderation",
    body: "Reviews that break the guidelines can be removed, with a logged reason.", // §5.8, §5.13
  },
  {
    icon: Wrench,
    title: "Transaction oversight",
    body: "Every transaction is logged and refundable by an admin.", // §5.7, §5.13
  },
  {
    icon: Scale,
    title: "Dispute resolution",
    body: "An admin rules for the client, rules for the artisan, or records a mutual resolution.", // §5.13
  },
] as const

export function ClientsSection() {
  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            {/* PRD §3, bullet 1 — verbatim except capitalisation */}
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Transparent, trustworthy and frictionless access to verified artisans.
            </h2>
            {/* PRD §2 client paragraph */}
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              You shouldn&rsquo;t have to take a stranger&rsquo;s word for it. On JinVa you can see who has
              been verified, what they&rsquo;ve built or fixed before, what other clients said after the job
              was done &mdash; and you keep a record of the booking and the payment.
            </p>
            <BulletList items={CLIENT_CAPABILITIES} />
            <Button size="lg" asChild className="mt-8">
              <Link href="/signup?role=CUSTOMER">Get started as a client</Link>
            </Button>
          </Reveal>

          <Reveal delay={120} className="lg:order-last">
            <div className="overflow-hidden rounded-2xl border border-border">
              <AspectRatio ratio={4 / 3}>
                <Image
                  src="/artisan-in-blue-uniform.jpg"
                  alt="An artisan arriving for a JinVa booking"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </AspectRatio>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export function ArtisansSection() {
  return (
    <section id="for-artisans" className="scroll-mt-20 border-y border-border bg-muted/40">
      <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Image first at lg, so this section mirrors the one above */}
          <Reveal delay={120} className="lg:order-first">
            <div className="overflow-hidden rounded-2xl border border-border">
              <AspectRatio ratio={4 / 3}>
                <Image
                  src="/artisan-in-orange-vest.jpg"
                  alt="A JinVa artisan at work on a job"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </AspectRatio>
            </div>
          </Reveal>

          <Reveal>
            {/* PRD §3, bullet 2 — verbatim */}
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Build a professional reputation, manage your own schedule, and get paid reliably.
            </h2>
            {/* PRD §2 artisan paragraph */}
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Word of mouth doesn&rsquo;t scale, and it doesn&rsquo;t pay on time. JinVa gives you a profile
              that shows what you can actually do, a calendar you control, and a payout that lands in your
              bank account or mobile wallet after the job.
            </p>
            <BulletList items={ARTISAN_CAPABILITIES} />
            {/* LP13 — the role selector on /signup reads this param on mount */}
            <Button size="lg" asChild className="mt-8">
              <Link href="/signup?role=ARTISAN">List your trade on JinVa</Link>
            </Button>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {ARTISAN_CARDS.map((card, index) => (
            <Reveal asChild delay={index * 80} key={card.title}>
              <Card className="h-full gap-3 px-6 py-6">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <card.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold text-card-foreground">{card.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * Platform governance.
 *
 * HARD RULE: no signup CTA, no "become an admin", no link into signup anywhere
 * in this section (LP5, PRD §5.1 — admin accounts are seeded by JinVa and are
 * not publicly registerable). The closing note below stands in place of a
 * button: it satisfies LP5 and pre-empts the visitor's obvious "…can I be one?"
 * instead of leaving a conspicuous hole where every other section has a CTA.
 *
 * No photo either — illustrating platform governance with an artisan portrait
 * would be misleading. Icons only.
 */
export function GovernanceSection() {
  return (
    <section id="platform-governance" className="scroll-mt-20 bg-background">
      <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Someone is actually checking.
          </h2>
          {/* PRD §3, bullet 3 */}
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            JinVa has an internal admin team with full visibility into platform activity, and tools to
            enforce quality and resolve disputes.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {GOVERNANCE_CARDS.map((card, index) => (
            <Reveal asChild delay={index * 60} key={card.title}>
              <Card className="h-full gap-3 px-5 py-5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <card.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold text-card-foreground">{card.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Admin accounts are created by JinVa internally and are not open for registration.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
