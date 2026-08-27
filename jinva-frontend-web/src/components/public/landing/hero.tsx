import type React from "react"
import Link from "next/link"
import { PublicLink } from "@/components/public/public-link"
import Image from "next/image"
import { ChevronDown, Info, Lock, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RatingStars } from "@/components/ui/rating-stars"
import { BrandPattern } from "@/components/brand/brand-pattern"
import { getBookingStatusConfig } from "@/lib/status-badges"

/**
 * Hero — design-spec.md §3.3.
 *
 * Direction: problem-first, traced to PRD §2's core-gap callout, with the
 * supporting paragraph carrying PRD §2's client pain (can't evaluate quality,
 * price or availability; no booking or payment trail) and PRD §1's category
 * list.
 *
 * NO amounts anywhere in the composition, and no aggregate numbers: prices and
 * fee percentages are forbidden on this page, and a platform statistic would be
 * fabricated (LP8). The one number here — the sample artisan's 4.8 (37) — is
 * product UI inside a mock profile card, per §3.3.
 *
 * LP8 FOLLOW-UP: "product UI, not a statistic" is the right reading, but QA was
 * correct that nothing on screen said so, and LP8 requires any number shown to be
 * endpoint-backed or explicitly labelled. Per the recorded decision the card now
 * carries the SAME marker the testimonials section uses — an outline `Badge` with
 * an `Info` icon reading "Sample content" — so the two illustrative surfaces on
 * this page are labelled identically. If this card is ever wired to a real
 * artisan record, remove that badge along with the hardcoded name and rating.
 *
 * The `data-enter` attributes drive a CSS-only load animation rather than the
 * IntersectionObserver reveal the rest of the page uses. The hero is the largest
 * contentful paint; holding it invisible until hydration would trade a real
 * performance metric for a flourish. Reduced-motion drops it entirely.
 */
export function Hero() {
  const confirmed = getBookingStatusConfig("CONFIRMED")

  return (
    <section className="relative overflow-hidden bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 pt-10 pb-16 sm:px-6 md:pt-20 md:pb-24 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Copy */}
          <div>
            <h1
              data-enter
              className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
            >
              Hiring a skilled artisan shouldn&rsquo;t depend on word of mouth.
            </h1>
            <p
              data-enter
              style={{ "--reveal-delay": "100ms" } as React.CSSProperties}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            >
              JinVa connects you with verified electricians, plumbers, carpenters, painters, cleaners,
              landscapers and beauty professionals. See their past work and their prices before you book, get
              a real booking and a real payment record, and keep your money withheld until you confirm the
              job is done.
            </p>

            <div
              data-enter
              style={{ "--reveal-delay": "200ms" } as React.CSSProperties}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Button size="lg" asChild>
                <Link href="/signup">Get started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Log in</Link>
              </Button>
            </div>

            <div
              data-enter
              style={{ "--reveal-delay": "300ms" } as React.CSSProperties}
              className="mt-4"
            >
              <Button variant="link" asChild className="h-auto px-0">
                <PublicLink href="/#how-it-works">
                  See how it works
                  <ChevronDown className="h-4 w-4" />
                </PublicLink>
              </Button>
            </div>
          </div>

          {/* Brand panel composition */}
          <div
            data-enter
            style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
            className="relative flex items-center overflow-hidden rounded-2xl bg-linear-to-br from-brand to-brand-accent px-8 py-14 sm:px-12 sm:py-20 lg:min-h-[26rem]"
          >
            <BrandPattern />
            {/* One decorative blurred orb. Inside the overflow-hidden parent so
                it can never force a horizontal scrollbar. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-linear-to-br from-brand-accent/30 to-transparent blur-3xl"
            />

            <div className="relative z-10 mx-auto w-full max-w-xs sm:max-w-sm">
              {/* Sample booking chip — dropped at 375px, where an overlapping
                  rotated card in a 343px column is a mess (§7) */}
              <div className="absolute -top-8 -right-3 z-20 hidden rotate-6 rounded-xl bg-brand-accent/95 p-3 shadow-xl ring-1 ring-brand-foreground/15 transition-transform duration-500 motion-safe:hover:rotate-3 md:block">
                <p className="text-sm font-medium text-brand-foreground">Thu 3 Sep &middot; 9:00&ndash;11:00</p>
                {/*
                  The LABEL comes from the shared status map, so the hero speaks
                  the app's own vocabulary — but the tinted `bg-primary/10
                  text-primary` surface that map carries is deep green on deep
                  green here and measured as unreadable. On the brand gradient the
                  pill needs a solid fill, so it uses `--success` (white-on-green
                  in light, near-black-on-bright-green in dark).
                */}
                <Badge className="mt-2 border-transparent bg-success text-success-foreground">
                  {confirmed.label}
                </Badge>
              </div>

              {/* Sample artisan card */}
              <div className="relative z-10 rounded-2xl bg-card p-6 shadow-2xl transition-transform duration-500 motion-safe:hover:scale-105">
                {/* Sits above the avatar row rather than beside "Verified" — in
                    that row it would read as another artisan attribute, which is
                    the opposite of the point. */}
                <Badge variant="outline" className="mb-4">
                  <Info className="h-3 w-3" aria-hidden="true" />
                  Sample content
                </Badge>
                <div className="flex items-center gap-4">
                  <Image
                    src="/artisan-in-hard-hat.jpg"
                    alt="A JinVa artisan on site"
                    width={56}
                    height={56}
                    className="size-14 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-card-foreground">Kwame Asante</p>
                    <p className="truncate text-sm text-muted-foreground">Plumbing &middot; Accra</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                    <ShieldCheck className="h-3 w-3" />
                    Verified
                  </Badge>
                  <RatingStars rating={4.8} totalReviews={37} size="sm" />
                </div>
              </div>

              {/* Escrow reassurance chip */}
              <div className="absolute -bottom-8 -left-3 z-20 flex items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-xl">
                <Lock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-sm font-medium text-card-foreground">Payment withheld until you confirm</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
