"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { BadgeCheck, CalendarCheck, LifeBuoy, Star, Wallet } from "lucide-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import type { SelfSignupRole } from "@/lib/signup-flow"

/**
 * Auth redesign (approved 3 Nov 2026): the brand side of every auth screen.
 *
 * - `BrandPanel` (≥ 980px): three columns of JinVa's own photos drifting
 *   slowly up and down under the brand gradient, a headline that follows the
 *   chosen role, and a cycling activity card that is labelled "Sample
 *   activity" (the honesty rule against fabricated figures, LP8).
 * - `PhoneStrip` (< 980px): the slim 88px brand strip that replaces the side
 *   panel on phones: logo, a line that changes every few seconds, and a small
 *   photo that crossfades and slowly zooms. No scrolling photos on phones.
 *
 * Motion is CSS (./auth-motion.css), transform and opacity only, and only
 * under `prefers-reduced-motion: no-preference`. The timers that swap the
 * text and photos stop with reduced motion (the first item simply stays), when
 * the tab is hidden, and while the surface isn't displayed at this width.
 * Colours are the brand tokens in both themes; the photo scrims are tuned per
 * theme in auth-motion.css.
 */

const WIDE = "(min-width: 980px)"
const NARROW = "(max-width: 979.98px)"
const CYCLE_MS = 3600

/** A counter that ticks every `intervalMs` while motion is allowed, the tab is visible and `media` matches. */
function useCycle(intervalMs: number, media: string) {
  const [tick, setTick] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    const shown = window.matchMedia(media)
    let timer: ReturnType<typeof setInterval> | undefined
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = undefined
    }
    const sync = () => {
      stop()
      setHidden(document.hidden)
      if (reduce.matches || document.hidden || !shown.matches) return
      timer = setInterval(() => setTick((t) => t + 1), intervalMs)
    }
    sync()
    document.addEventListener("visibilitychange", sync)
    reduce.addEventListener("change", sync)
    shown.addEventListener("change", sync)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", sync)
      reduce.removeEventListener("change", sync)
      shown.removeEventListener("change", sync)
    }
  }, [intervalMs, media])

  return { tick, paused: hidden }
}

const PANEL_COPY: Record<SelfSignupRole, { title: string; text: string }> = {
  CUSTOMER: {
    title: "Skilled hands, booked with confidence.",
    text: "Verified artisans, real time slots, and payment released only after you confirm the job is done.",
  },
  ARTISAN: {
    title: "Get booked for the work you’re good at.",
    text: "Show your past work, set your prices and hours, and get paid to MoMo or bank after each job.",
  },
}

const COLUMNS = [
  {
    drift: "auth-drift-up",
    offset: "",
    aspect: "aspect-[3/4.2]",
    photos: ["/artisan-in-hard-hat.jpg", "/portfolio/job-kitchen-sink.jpg", "/artisan-in-orange-vest.jpg"],
  },
  {
    drift: "auth-drift-down",
    offset: "mt-16",
    aspect: "aspect-[1/1.15]",
    photos: ["/portfolio/job-pipe-install.jpg", "/artisan-in-red-vest.jpg", "/portfolio/job-bathroom-reno.jpg"],
  },
  {
    drift: "auth-drift-up auth-drift-slow",
    offset: "mt-6",
    aspect: "aspect-[3/4]",
    photos: ["/artisan-in-blue-uniform.jpg", "/portfolio/job-water-heater.jpg", "/portfolio/job-drain-clean.jpg"],
  },
] as const

const ACTIVITY: readonly {
  title: string
  text: string
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}[] = [
  { title: "Booking confirmed", text: "Ama booked a plumber in Osu for Thursday", icon: CalendarCheck },
  { title: "Artisan verified", text: "Yaw, an electrician in Tema, got the badge", icon: BadgeCheck },
  { title: "Job confirmed and paid", text: "GH₵ 350.00 sent to Kwame’s MoMo", icon: Wallet },
  { title: "New 5-star review", text: "“Fixed the leak in an hour, very tidy.”", icon: Star },
]

const STRIP_LINES = [
  "Verified artisans across Ghana",
  "Pay only after the job is done",
  "Plumbers, electricians, carpenters and more",
  "Get paid to MoMo or bank",
] as const

const STRIP_PHOTOS = [
  "/artisan-in-hard-hat.jpg",
  "/artisan-in-orange-vest.jpg",
  "/artisan-in-red-vest.jpg",
  "/portfolio/job-pipe-install.jpg",
  "/artisan-in-blue-uniform.jpg",
] as const

export function BrandPanel({ role }: { role: SelfSignupRole | null }) {
  const { tick, paused } = useCycle(CYCLE_MS, WIDE)
  const copy = PANEL_COPY[role === "ARTISAN" ? "ARTISAN" : "CUSTOMER"]
  const item = ACTIVITY[tick % ACTIVITY.length]
  const Icon = item.icon

  return (
    <aside
      aria-label="About JinVa"
      data-paused={paused ? "true" : undefined}
      className="auth-panel relative hidden overflow-hidden bg-brand text-brand-foreground min-[980px]:block"
    >
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div aria-hidden="true" className="auth-photo-cols absolute inset-0 grid grid-cols-3 gap-3.5 px-7">
          {COLUMNS.map((col, c) => (
            <div key={c} className={cn("flex flex-col gap-3.5 pb-3.5", col.drift, col.offset)}>
              {/* Four copies, so translating by half always leaves the panel covered. */}
              {[0, 1, 2, 3].flatMap((copyIndex) =>
                col.photos.map((src, i) => (
                  <Image
                    key={`${copyIndex}-${i}`}
                    src={src}
                    alt=""
                    width={360}
                    height={480}
                    sizes="(min-width: 980px) 17vw, 1px"
                    draggable={false}
                    className={cn("block h-auto w-full rounded-[18px] object-cover", col.aspect)}
                  />
                )),
              )}
            </div>
          ))}
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="auth-scrim-top px-10 pb-28 pt-8 xl:px-14">
            <div className="flex justify-end">
              <Link
                href="/contact"
                className="-mr-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-brand-foreground transition-colors hover:bg-brand-foreground/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-foreground/50"
              >
                <LifeBuoy className="h-4 w-4" aria-hidden="true" />
                Need help?
              </Link>
            </div>
            <div key={copy.title} className="auth-panel-copy mt-6 max-w-[34rem]">
              <p className="auth-display max-w-[12em] text-[clamp(2rem,2.9vw,2.75rem)] font-extrabold leading-[1.04] tracking-[-0.03em]">
                {copy.title}
              </p>
              <p className="mt-3 max-w-[28em] text-[0.9375rem] leading-relaxed text-brand-foreground/90 xl:text-base">
                {copy.text}
              </p>
            </div>
          </div>

          <div aria-hidden="true" className="auth-scrim-bottom px-10 pb-12 pt-28 xl:px-14">
            <div className="w-full max-w-[22.5rem]">
              <div
                key={tick}
                className="auth-activity flex items-center gap-3 rounded-2xl bg-card p-3.5 pr-4 text-card-foreground shadow-2xl"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 text-sm leading-snug">
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-muted-foreground">{item.text}</span>
                </span>
              </div>
              <p className="mt-2 text-xs text-brand-foreground/85">Sample activity</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export function PhoneStrip() {
  const { tick, paused } = useCycle(CYCLE_MS, NARROW)
  const line = STRIP_LINES[tick % STRIP_LINES.length]
  const current = tick % STRIP_PHOTOS.length
  const previous = tick === 0 ? -1 : (tick - 1) % STRIP_PHOTOS.length

  return (
    <div
      data-paused={paused ? "true" : undefined}
      className="auth-strip relative flex h-[88px] shrink-0 items-center gap-3 overflow-hidden bg-brand px-5 text-brand-foreground min-[980px]:hidden [@media(max-height:640px)]:hidden"
    >
      <div className="min-w-0 flex-1">
        <Link
          href="/"
          aria-label="JinVa home"
          className="-ml-1 inline-flex min-h-11 items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-foreground/50"
        >
          <Logo tone="on-brand" className="[&_span]:text-xl [&_svg]:size-7" />
        </Link>
        <p
          key={line}
          aria-hidden="true"
          className="auth-strip-line -mt-1.5 line-clamp-2 pl-9 text-[0.8125rem] leading-tight text-brand-foreground/90"
        >
          {line}
        </p>
      </div>
      <Link
        href="/contact"
        aria-label="Need help?"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-brand-foreground transition-colors hover:bg-brand-foreground/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-foreground/50"
      >
        <LifeBuoy className="h-5 w-5" aria-hidden="true" />
      </Link>
      <span
        aria-hidden="true"
        className="relative size-[60px] shrink-0 overflow-hidden rounded-2xl bg-brand-accent ring-2 ring-brand-foreground/20"
      >
        {STRIP_PHOTOS.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt=""
            width={120}
            height={120}
            sizes="60px"
            draggable={false}
            data-state={i === current ? "on" : i === previous ? "prev" : "off"}
            className="auth-strip-photo absolute inset-0 size-full object-cover object-[center_25%]"
          />
        ))}
      </span>
    </div>
  )
}
