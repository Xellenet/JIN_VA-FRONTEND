import type React from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { BrandPattern } from "@/components/brand/brand-pattern"
import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

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
        <div className="relative z-10 space-y-8 max-w-lg">
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

            {/* Card Visual */}
            <div className="relative min-h-44 pt-2">
              <div className="absolute -top-4 right-0 w-64 h-40 bg-linear-to-br from-brand-accent to-brand rounded-xl shadow-xl transform rotate-6 p-6 text-brand-foreground transition-all duration-500 hover:rotate-3 hover:scale-105">
                <div className="text-sm text-brand-foreground/80 mb-8">JinVa Pro</div>
                <div className="text-xl font-mono tracking-wider">7812 2139 0823 XXXX</div>
                <div className="mt-4 flex justify-between text-xs text-brand-foreground/80">
                  <span>08/27</span>
                  <span>08●●</span>
                </div>
              </div>

              {/* Bookings Widget */}
              <div className="absolute -bottom-8 -right-4 bg-card rounded-xl shadow-lg p-4 w-48 transition-all duration-500 hover:scale-105 hover:shadow-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center transition-colors duration-300">
                    <svg
                      className="w-5 h-5 text-muted-foreground"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Monthly Bookings</div>
                    <div className="text-2xl font-bold text-card-foreground">347</div>
                  </div>
                </div>
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
