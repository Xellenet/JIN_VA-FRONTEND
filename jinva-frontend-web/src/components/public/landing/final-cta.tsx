import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrandPattern } from "@/components/brand/brand-pattern"
import { Reveal } from "@/components/public/reveal"

/**
 * Final CTA band — design-spec.md §3.11. Closes the page before the footer.
 *
 * Both button overrides use only tokens (LP12): the primary is
 * `bg-brand-foreground text-brand`, which measures 10.8:1 and is deliberately
 * NOT `variant="secondary"` — that would be a dark button on a dark green panel
 * in the dark theme. The secondary is the tokenised form of the auth layout's
 * existing ghost-on-green button.
 *
 * Body copy on the brand gradient is `/80`; `/70` is the absolute floor.
 */
export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-brand to-brand-accent">
      <BrandPattern />
      <div className="relative z-10 mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-balance text-brand-foreground sm:text-4xl">
            Get the job done properly.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-brand-foreground/80 sm:text-lg">
            Create an account to book a verified artisan &mdash; or list your trade and start taking
            bookings.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              asChild
              className="bg-brand-foreground text-brand hover:bg-brand-foreground/90"
            >
              <Link href="/signup">Get started</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-brand-foreground/30 bg-transparent text-brand-foreground hover:bg-brand-foreground/10 hover:text-brand-foreground dark:bg-transparent dark:border-brand-foreground/30 dark:hover:bg-brand-foreground/10"
            >
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
