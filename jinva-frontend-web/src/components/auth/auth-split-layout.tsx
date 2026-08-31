import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { Logo } from "@/components/logo"
import { BrandPattern } from "@/components/brand/brand-pattern"
import { Info, MessageCircle, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RatingStars } from "@/components/ui/rating-stars"

/**
 * DT4 (design-spec.md §1.2): this file's colour literals are tokens.
 *
 * The brand gradient it used to hardcode as a pair of hex literals is now
 * `from-brand to-brand-accent`, the same pair the landing page's hero panel and
 * final CTA band use, so the marketing surfaces can never drift apart. The
 * `<defs>` grid/dot pattern moved to `<BrandPattern />` (unique SVG ids, so it
 * can appear more than once per document). Body copy on the gradient is
 * `text-brand-foreground/80` — that is the measured floor from §1.2; never go
 * below /70.
 *
 * Copy is now JinVa's actual pitch (PRD §1-§5), not the old beauty-vertical
 * leftover ("Grow your beauty business" on a platform that covers all trades).
 * Speaks to both sides of the marketplace since this layout is shared by
 * every auth screen, not just one role's signup.
 *
 * The card visual used to be a generic fintech-template pair (a fake "JinVa
 * Pro" payment card plus an unlabelled "347 Monthly Bookings" figure) that
 * matched neither JinVa's product — there's no card product — nor its
 * honesty rule against fabricated numbers (the same LP8 principle the
 * landing hero follows). Replaced with a compact version of the hero's own
 * sample-artisan snapshot, carrying the same "Sample content" label. Laid
 * out in normal flow (a `rotate-1` transform, not `absolute` positioning),
 * unlike the hero's floating chips — the auth panel is a single narrow
 * column, not a two-column layout with room to spare, and absolute
 * positioning here is exactly what caused the heading-collision bug this
 * file used to have.
 */

interface AuthSplitLayoutProps {
  children: React.ReactNode
}

export function AuthSplitLayout({ children }: Readonly<AuthSplitLayoutProps>) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Form */}
      <div className="flex flex-col bg-background">
        <div className="p-8">
          <Logo />
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>

      {/* Right side - Marketing Content */}
      <div className="hidden lg:flex relative bg-linear-to-br from-brand to-brand-accent p-12 items-center justify-center overflow-hidden">
        {/* Background Pattern */}
        <BrandPattern />

        {/* Support Button */}
        <Button
          variant="ghost"
          className="absolute top-8 right-8 text-brand-foreground/90 hover:text-brand-foreground hover:bg-brand-foreground/10 transition-all duration-300"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Support
        </Button>

        {/* Main Content */}
        <div className="relative z-10 space-y-6 max-w-lg">
          {/* Feature Card */}
          <div className="bg-card rounded-2xl p-8 shadow-2xl space-y-6 transform transition-all duration-500 hover:scale-105">
            <div className="transition-opacity duration-300">
              <h3 className="text-3xl font-bold text-card-foreground mb-3 transition-colors duration-300">
                Hire skilled artisans you can trust
              </h3>
              <p className="text-muted-foreground leading-relaxed transition-colors duration-300">
                JinVa connects you with verified electricians, plumbers, carpenters, painters, cleaners and
                landscapers. See real reviews and past work before you book, and your payment stays withheld
                until the job is confirmed done.
              </p>
            </div>

            <Button
              asChild
              className="bg-brand hover:bg-brand-accent text-brand-foreground px-8 transition-all duration-300 hover:scale-105"
            >
              <Link href="/">Learn more</Link>
            </Button>
          </div>

          {/* Sample artisan snapshot — see file header re: why this replaced
              the old fake card/stat pairing */}
          <div className="flex flex-col items-start gap-2 pl-2">
            <Badge variant="outline" className="bg-card/90">
              <Info className="h-3 w-3" aria-hidden="true" />
              Sample content
            </Badge>
            <div className="flex items-center gap-3 rounded-xl bg-card p-3 pr-5 shadow-xl ring-1 ring-brand-foreground/10 rotate-1 transition-all duration-500 hover:rotate-0 hover:scale-105">
              <Image
                src="/artisan-in-hard-hat.jpg"
                alt="A JinVa artisan on site"
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-card-foreground">Kwame Asante</p>
                <p className="truncate text-xs text-muted-foreground">Plumbing &middot; Accra</p>
              </div>
              <div className="ml-1 flex items-center gap-2 border-l border-border pl-3">
                <Badge
                  variant="outline"
                  className="border-primary/20 bg-primary/10 px-1.5 text-primary"
                  aria-label="Verified"
                >
                  <ShieldCheck className="h-3 w-3" />
                </Badge>
                <RatingStars rating={4.8} size="sm" showCount={false} />
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="pt-12 space-y-4 transition-opacity duration-500">
            <h4 className="text-3xl font-bold text-brand-foreground transition-all duration-300">
              Every trade, one platform
            </h4>
            <p className="text-brand-foreground/80 leading-relaxed transition-all duration-300">
              Whether you&apos;re hiring for a job or building your business as an artisan, JinVa gives you
              verified profiles, real bookings, secure payments, and a reputation you can build on.
            </p>

            {/* Pagination Dots */}
            <div className="flex items-center gap-3 pt-4" aria-hidden="true">
              <span className="w-2 h-2 rounded-full bg-brand-foreground/40 transition-all duration-300" />
              <span className="w-2 h-2 rounded-full bg-brand-foreground transition-all duration-300" />
              <span className="w-2 h-2 rounded-full bg-brand-foreground/40 transition-all duration-300" />
            </div>
          </div>
        </div>

        {/* Decorative Gradient Orb */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-linear-to-br from-brand-accent/30 to-transparent rounded-full blur-3xl transition-opacity duration-700" />
      </div>
    </div>
  )
}
