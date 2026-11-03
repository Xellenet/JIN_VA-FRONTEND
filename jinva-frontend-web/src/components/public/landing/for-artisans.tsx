import Image from "next/image"
import Link from "next/link"
import { Check } from "lucide-react"
import { signupHref } from "@/lib/landing-search"
import { LoopGate } from "./loop-gate"
import { PHOTOS, PHOTO_SIZE } from "./landing-content"
import { SectionHeading } from "./section-heading"

const TICKS = [
  "A public profile with a verified badge",
  "Booking requests in your calendar",
  "An earnings statement you can download",
]

/**
 * For artisans: a deep brand band (the dark brand token in dark mode) with the
 * portrait, a floating sample earnings card and the "List your services" CTA.
 */
export function ForArtisans() {
  return (
    <section id="artisans" aria-labelledby="art-h" className="scroll-mt-16 bg-brand text-brand-foreground">
      <div className="mx-auto grid w-full max-w-310 items-center gap-14 px-4 py-18 sm:px-6 md:py-24 lg:grid-cols-2 lg:px-8">
        <div className="min-w-0">
          <SectionHeading id="art-h" className="mb-4.5">
            Get booked for the work you’re good at.
          </SectionHeading>
          <p className="mb-6.5 max-w-[30em] text-lg text-brand-foreground/85">
            Show your past work, set your prices and hours, and get paid to mobile money or your bank after each job.
            The name on your payout account is checked, so the money goes to you.
          </p>
          <ul className="mb-8 flex list-none flex-col gap-3 p-0">
            {TICKS.map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-brand-foreground/95">
                <Check aria-hidden="true" className="size-4.5 flex-none text-brand-highlight" strokeWidth={2.6} />
                {t}
              </li>
            ))}
          </ul>
          <Link
            href={signupHref("artisan")}
            className="inline-flex min-h-13 items-center rounded-xl bg-brand-foreground px-6 font-semibold text-brand outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-brand-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
          >
            List your services
          </Link>
        </div>

        <LoopGate className="relative min-w-0">
          <Image
            src={PHOTOS.carpenter}
            alt="A smiling carpenter carrying supplies in his workshop"
            width={PHOTO_SIZE.portrait.width}
            height={PHOTO_SIZE.portrait.height}
            sizes="(min-width: 1024px) 480px, 100vw"
            className="ml-auto block aspect-[4/5] w-full rounded-[1.625rem] object-cover sm:max-w-120"
          />
          <div className="lp-float relative mx-4 -mt-15 rounded-2xl bg-card px-5 py-4.5 text-card-foreground shadow-2xl shadow-black/40 sm:absolute sm:bottom-7 sm:left-0 sm:mx-0 sm:mt-0 sm:w-[min(320px,82%)]">
            <p className="text-[0.8125rem] text-muted-foreground">Paid to you this month · sample</p>
            <p className="mt-0.5 mb-2.5 font-display text-[2.125rem] leading-tight font-extrabold tracking-[-0.02em]">
              GH₵ 2,450.00
            </p>
            <p className="mb-1.5 text-[0.8125rem] text-muted-foreground">MTN MoMo ••4567 · name checked</p>
            <div
              role="progressbar"
              aria-label="Profile setup"
              aria-valuemin={0}
              aria-valuemax={6}
              aria-valuenow={4}
              aria-valuetext="4 of 6 done"
              className="mt-3 h-2 overflow-hidden rounded-full bg-primary/15"
            >
              <span className="block h-full w-2/3 bg-primary" />
            </div>
            <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">Setup: 4 of 6 done</p>
          </div>
        </LoopGate>
      </div>
    </section>
  )
}
