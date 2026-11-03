import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { Logo } from "@/components/logo"
import { BrandPattern } from "@/components/brand/brand-pattern"
import { Info, LifeBuoy, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { RatingStars } from "@/components/ui/rating-stars"
import "./auth-motion.css"

/**
 * The frame every auth screen sits in: the form on the left, JinVa's brand
 * panel on the right from `lg` up (DT4: colour literals are tokens —
 * `from-brand to-brand-accent`, the pair the landing hero and CTA band use).
 *
 * Auth v2 polish:
 * - The brand panel is sticky, so a long form scrolls while the panel stays.
 * - The form column is one measured width (26.5rem) with a 16px gutter on
 *   phones and a vertically centred body, so every step lands in the same place.
 * - Removed the dead "Support" button (it had no handler; it is now a link to
 *   the contact page), the decorative carousel dots that suggested slides that
 *   don't exist, and hover zooms on content that isn't interactive.
 * - The sample artisan snapshot keeps its "Sample content" label (the honesty
 *   rule against fabricated figures, LP8).
 * - The step / code / check motion lives in ./auth-motion.css, imported here
 *   because this layout is on every auth page and nowhere else.
 */

interface AuthSplitLayoutProps {
  children: React.ReactNode
}

export function AuthSplitLayout({ children }: Readonly<AuthSplitLayoutProps>) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between px-4 pt-4 sm:px-8 sm:pt-7">
          <Link href="/" aria-label="JinVa home" className="inline-flex min-h-11 items-center rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30">
            <Logo />
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 lg:hidden"
          >
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Help
          </Link>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-8 sm:items-center sm:px-8 sm:py-12">
          <div className="w-full max-w-[26.5rem]">{children}</div>
        </main>
      </div>

      <aside
        aria-label="About JinVa"
        className="relative hidden overflow-hidden bg-linear-to-br from-brand to-brand-accent lg:block"
      >
        <div className="sticky top-0 flex h-dvh items-center justify-center p-12 xl:p-16">
          <BrandPattern />

          <Link
            href="/contact"
            className="absolute right-8 top-8 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-brand-foreground/90 transition-colors hover:bg-brand-foreground/10 hover:text-brand-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-foreground/40"
          >
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Need help?
          </Link>

          <div className="relative z-10 w-full max-w-lg space-y-10">
            <div className="space-y-5 rounded-2xl bg-card p-8 shadow-2xl ring-1 ring-brand-foreground/10">
              <p className="text-2xl font-semibold leading-snug tracking-tight text-card-foreground xl:text-[1.75rem]">
                Hire skilled artisans you can trust
              </p>
              <p className="leading-relaxed text-muted-foreground">
                JinVa connects you with verified electricians, plumbers, carpenters, painters, cleaners and
                landscapers. See real reviews and past work before you book, and your payment stays withheld until
                the job is confirmed done.
              </p>
              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
              >
                Learn more
              </Link>
            </div>

            <div className="flex flex-col items-start gap-2 pl-2">
              <Badge variant="outline" className="bg-card/90">
                <Info className="h-3 w-3" aria-hidden="true" />
                Sample content
              </Badge>
              <div className="flex items-center gap-3 rounded-xl bg-card p-3 pr-5 shadow-xl ring-1 ring-brand-foreground/10 rotate-1">
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
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 px-1.5 text-primary">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">Verified</span>
                  </Badge>
                  <RatingStars rating={4.8} size="sm" showCount={false} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-3xl font-semibold tracking-tight text-brand-foreground">Every trade, one platform</p>
              <p className="max-w-md leading-relaxed text-brand-foreground/80">
                Whether you&apos;re hiring for a job or building your business as an artisan, JinVa gives you verified
                profiles, real bookings, secure payments, and a reputation you can build on.
              </p>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-linear-to-br from-brand-accent/30 to-transparent blur-3xl"
          />
        </div>
      </aside>
    </div>
  )
}
