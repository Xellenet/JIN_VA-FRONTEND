"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { JOB_FLOW, JOB_STAGES, PHOTOS, PHOTO_SIZE } from "./landing-content"
import { useLoopActive } from "./loop-gate"
import { SectionHeading, SectionLead } from "./section-heading"

const STEP_MS = 1800
const LAST = JOB_STAGES.length - 1

/**
 * "How a job runs": the five-step you / your artisan table and a sample job
 * card whose track walks Booked → In progress → Done → Paid out.
 *
 * The card auto-advances ONCE, the first time it is on screen with motion
 * allowed; it waits while the tab is hidden. Under reduced motion it rests on
 * the final stage and only moves when someone presses "Play it again". The
 * status line is a polite live region and the matching table row is marked
 * with `aria-current`.
 */
export function HowAJobRuns() {
  const cardRef = useRef<HTMLElement>(null)
  const { reduced, inView, pageVisible } = useLoopActive(cardRef, 0.4)
  const [stage, setStage] = useState(0)
  const [running, setRunning] = useState(false)
  const started = useRef(false)

  // First sight: play once, or rest on the last stage under reduced motion.
  useEffect(() => {
    if (started.current || reduced === null) return
    if (reduced) {
      started.current = true
      setStage(LAST)
    } else if (inView) {
      started.current = true
      setStage(0)
      setRunning(true)
    }
  }, [reduced, inView])

  useEffect(() => {
    if (!running || !pageVisible) return
    if (stage >= LAST) {
      setRunning(false)
      return
    }
    const id = window.setTimeout(() => setStage((s) => Math.min(LAST, s + 1)), STEP_MS)
    return () => window.clearTimeout(id)
  }, [running, pageVisible, stage])

  const replay = () => {
    started.current = true
    setStage(0)
    setRunning(true)
  }

  const current = JOB_STAGES[stage]

  return (
    <section id="how" aria-labelledby="how-h" className="scroll-mt-16 bg-primary/5">
      <div className="mx-auto w-full max-w-310 px-4 py-18 sm:px-6 md:py-24 lg:px-8">
        <SectionHeading id="how-h">How a job runs.</SectionHeading>
        <SectionLead className="mb-11 max-w-[38em] text-foreground/75">
          The same five steps for both of you, so you always know whose move it is.
        </SectionLead>

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div
            role="table"
            aria-label="What you and your artisan do at each step"
            className="min-w-0 overflow-hidden rounded-3xl border border-border bg-card text-card-foreground"
          >
            <div role="rowgroup" className="max-sm:hidden">
              <div
                role="row"
                className="grid grid-cols-[8rem_repeat(2,minmax(0,1fr))] border-b border-border bg-muted/50 text-sm font-semibold text-muted-foreground"
              >
                <span role="columnheader" className="px-4.5 py-3.5">Step</span>
                <span role="columnheader" className="px-4.5 py-3.5">You</span>
                <span role="columnheader" className="border-l border-border px-4.5 py-3.5">Your artisan</span>
              </div>
            </div>
            <div role="rowgroup">
              {JOB_FLOW.map((row, i) => {
                const active = current.row === i
                return (
                  <div
                    key={row.step}
                    role="row"
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "relative grid border-b border-border last:border-b-0 sm:grid-cols-[8rem_repeat(2,minmax(0,1fr))]",
                      active && "bg-primary/8",
                    )}
                  >
                    {active ? (
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
                    ) : null}
                    <span role="rowheader" className="flex items-baseline gap-2.5 px-4.5 pt-4.5 pb-1 sm:pb-4.5">
                      <span className="font-display text-[1.625rem] leading-none font-extrabold text-primary">{row.n}</span>
                      <span className="font-semibold">{row.step}</span>
                    </span>
                    <span role="cell" className="px-4.5 py-1 text-[0.9375rem] sm:py-4.5">
                      <span className="block text-xs font-semibold text-muted-foreground sm:hidden">You</span>
                      {row.you}
                    </span>
                    <span
                      role="cell"
                      className="px-4.5 pt-1 pb-4.5 text-[0.9375rem] sm:border-l sm:border-border sm:pt-4.5"
                    >
                      <span className="block text-xs font-semibold text-muted-foreground sm:hidden">Your artisan</span>
                      {row.artisan}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <article
            ref={cardRef}
            aria-label="A sample job on JinVa"
            className="min-w-0 overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl shadow-brand/20"
          >
            <div className="relative">
              <Image
                src={PHOTOS.sink}
                alt="The kitchen sink in this sample job"
                width={PHOTO_SIZE.square.width}
                height={PHOTO_SIZE.square.height}
                sizes="(min-width: 1024px) 580px, 100vw"
                className="block aspect-[2/1] w-full object-cover"
              />
              <span className="absolute top-3.5 left-3.5 rounded-full bg-card/95 px-2.5 py-1 text-xs font-medium text-card-foreground">
                Sample job
              </span>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[0.8125rem] text-muted-foreground">Kitchen sink leak · Osu</p>
                  <p className="mt-0.5 font-display text-2xl font-bold">GH₵ 350.00</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <Image
                    src={PHOTOS.blue}
                    alt=""
                    width={88}
                    height={88}
                    sizes="44px"
                    className="size-11 rounded-full object-cover object-top"
                  />
                  <div className="text-sm leading-snug">
                    <p className="font-semibold">Kwame Asante</p>
                    <p className="text-muted-foreground">Verified · Plumbing · 4.8</p>
                  </div>
                </div>
              </div>

              <ol aria-label="Job progress" className="relative mt-6 grid list-none grid-cols-4 gap-1.5 p-0">
                <span aria-hidden="true" className="absolute inset-x-[12.5%] top-2.75 h-0.5 bg-border" />
                <span
                  aria-hidden="true"
                  style={{ transform: `scaleX(${stage / LAST})` }}
                  className="lp-track-fill absolute inset-x-[12.5%] top-2.75 h-0.5 origin-left bg-primary"
                />
                {JOB_STAGES.map((s, i) => {
                  const done = i < stage || (i === stage && stage === LAST)
                  const isCurrent = i === stage
                  return (
                    <li
                      key={s.label}
                      aria-current={isCurrent ? "step" : undefined}
                      className="relative flex flex-col items-center gap-2 text-center"
                    >
                      <span
                        className={cn(
                          "grid size-6 place-items-center rounded-full",
                          done
                            ? "bg-primary text-primary-foreground"
                            : isCurrent
                              ? "bg-card ring-2 ring-primary ring-offset-0 shadow-[0_0_0_7px] shadow-primary/15"
                              : "bg-card ring-2 ring-border",
                        )}
                      >
                        <Check
                          aria-hidden="true"
                          strokeWidth={3.2}
                          className={cn("lp-dot-check size-3", done ? "scale-100 opacity-100" : "scale-50 opacity-0")}
                        />
                      </span>
                      <span className={cn("text-[0.8125rem]", isCurrent ? "font-semibold" : "text-muted-foreground")}>
                        {s.label}
                        {done && !isCurrent ? <span className="sr-only"> (done)</span> : null}
                      </span>
                    </li>
                  )
                })}
              </ol>

              <div aria-live="polite" className="mt-5 rounded-2xl bg-primary/5 px-4 py-3.5 text-[0.9375rem] leading-normal">
                <div key={stage} data-swap>
                  <p className="font-semibold">{current.title}</p>
                  <p className="mt-0.5 text-foreground/75">{current.text}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={replay}
                className="mt-2.5 min-h-11 cursor-pointer rounded-md px-0 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60"
              >
                Play it again
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
