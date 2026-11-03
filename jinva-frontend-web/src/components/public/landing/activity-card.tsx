"use client"

import { useEffect, useRef, useState } from "react"
import { CalendarDays, ShieldCheck, Star, Wallet } from "lucide-react"
import { SAMPLE_ACTIVITY, type ActivityIcon } from "./landing-content"
import { useLoopActive } from "./loop-gate"

const ICONS: Record<ActivityIcon, typeof CalendarDays> = {
  calendar: CalendarDays,
  shield: ShieldCheck,
  wallet: Wallet,
  star: Star,
}

const CYCLE_MS = 3600

/**
 * The hero's "Sample activity" card: four sample events, one at a time.
 *
 * Cycles only while motion is allowed, the card is on screen and the tab is
 * visible. Under reduced motion it shows the first event and stays put. It is
 * not a live region: announcing a made-up event every few seconds would only
 * get in a screen-reader user's way, and the list is read as one card.
 */
export function ActivityCard({ className }: { readonly className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { active } = useLoopActive(ref)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SAMPLE_ACTIVITY.length), CYCLE_MS)
    return () => window.clearInterval(id)
  }, [active])

  const event = SAMPLE_ACTIVITY[index]
  const Icon = ICONS[event.icon]

  return (
    <div ref={ref} className={className}>
      <figure aria-label="Sample activity" className="m-0">
        <div
          key={index}
          className={`flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-card-foreground shadow-2xl shadow-black/40 ${index ? "lp-arrive" : ""}`}
        >
          <span
            aria-hidden="true"
            className="grid size-10 flex-none place-items-center rounded-xl bg-primary/10 text-primary"
          >
            <Icon className="size-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 text-sm leading-snug">
            <span className="block font-semibold">{event.title}</span>
            <span className="block text-muted-foreground">{event.text}</span>
          </span>
        </div>
        <figcaption className="mt-2 flex justify-end">
          <span className="rounded-full bg-brand/85 px-2.5 py-0.5 text-xs text-brand-foreground">Sample activity</span>
        </figcaption>
      </figure>
    </div>
  )
}
