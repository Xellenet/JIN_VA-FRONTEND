import type React from "react"
import Image from "next/image"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { HeroSearch } from "./hero-search"
import { ActivityCard } from "./activity-card"
import { LoopGate } from "./loop-gate"
import { HERO_COLUMNS, sizeOf } from "./landing-content"

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as React.CSSProperties

/**
 * Hero on the deep brand surface: copy, search, "Post a job", and on screens
 * from 820px three photo columns drifting in two directions (decorative,
 * `alt=""`, masked top and bottom) with the sample activity card over them.
 *
 * Phones get no photo animation at all (owner's call): the columns are
 * `display: none` below 820px, so their lazy images are never fetched, and the
 * activity card sits under the search instead.
 *
 * `data-enter` is the existing CSS-only load entrance in globals.css (no
 * observer, reduced-motion skips it), so the LCP heading is never held back.
 */
export function LandingHero() {
  return (
    <section id="top" aria-labelledby="hero-h" className="relative overflow-hidden bg-brand text-brand-foreground">
      <div className="mx-auto grid w-full max-w-310 items-center gap-12 px-4 pt-9 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="min-w-0 pb-8 min-[820px]:pb-18">
          <p
            data-enter
            className="mb-4.5 inline-flex items-center gap-2 rounded-full border border-brand-foreground/15 bg-brand-foreground/10 px-3.5 py-1.5 text-sm text-brand-foreground/90"
          >
            <ShieldCheck aria-hidden="true" className="size-3.5 text-brand-highlight" strokeWidth={2.4} />
            Verified artisans across Ghana
          </p>
          <h1
            id="hero-h"
            data-enter
            style={delay(80)}
            className="mb-5.5 font-display text-[clamp(2.5rem,7vw,4.875rem)] leading-[0.98] font-extrabold tracking-[-0.035em] text-balance"
          >
            Skilled hands, booked with confidence.
          </h1>
          <p data-enter style={delay(180)} className="mb-8 max-w-[32em] text-lg leading-relaxed text-brand-foreground/85 sm:text-[1.1875rem]">
            Find a plumber, electrician, carpenter, painter or cleaner near you. See their past work and prices, book a
            real time slot, and your payment reaches them only after you confirm the job is done.
          </p>
          <div data-enter style={delay(300)}>
            <HeroSearch />
          </div>
          <p data-enter style={delay(450)} className="mt-4.5 text-[0.9375rem] text-brand-foreground/85">
            Rather have artisans come to you?{" "}
            <Link
              href="/dashboard/user/post-job"
              className="inline-flex min-h-11 items-center rounded-sm font-semibold text-brand-foreground underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-brand-highlight sm:min-h-0"
            >
              Post a job
            </Link>
          </p>
        </div>

        <div className="relative min-w-0">
          <LoopGate
            aria-hidden="true"
            data-enter=""
            style={delay(180)}
            className="lp-collage relative hidden h-105 grid-cols-3 gap-3.5 overflow-hidden min-[820px]:grid lg:h-160"
          >
            {HERO_COLUMNS.map((column, c) => (
              <div
                key={c}
                className={cn(
                  "flex flex-col gap-3.5",
                  column.offset,
                  column.direction === "up" ? "lp-drift-up" : "lp-drift-down",
                )}
              >
                {[...column.photos, ...column.photos].map((src, i) => {
                  const { width, height } = sizeOf(src)
                  return (
                    <Image
                      key={`${src}-${i}`}
                      src={src}
                      alt=""
                      width={width}
                      height={height}
                      priority={i === 0}
                      sizes="(min-width: 1240px) 200px, (min-width: 1024px) 16vw, (min-width: 820px) 31vw, 1px"
                      className={cn("block w-full rounded-2xl object-cover", column.aspect)}
                    />
                  )
                })}
              </div>
            ))}
          </LoopGate>

          <ActivityCard className="mb-10 w-full max-w-85 min-[820px]:absolute min-[820px]:right-4 min-[820px]:bottom-11 min-[820px]:mb-0 min-[820px]:w-[min(340px,calc(100%-2rem))] lg:right-9" />
        </div>
      </div>
    </section>
  )
}
