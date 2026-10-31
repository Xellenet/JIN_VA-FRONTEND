"use client"

/**
 * FR-4.4 "Spending over time". The only chart on the page drawn with Recharts
 * (`ChartContainer`, config key `c1` only, SEC-22). It is loaded with
 * `next/dynamic` from the Spending page, so Recharts ships on this route only.
 *
 * Accessibility (spec §6): Recharts' SVG is `aria-hidden`. Over it sits a row
 * of transparent buttons, one per bucket, that share the bars' band layout:
 * one tab stop enters the chart, arrows / Home / End move between columns
 * (roving tabindex), and focus shows the same tooltip as hover.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import type { SpendingAnalytics } from "@/lib/customer-api"
import {
  OVER_TIME_CHART_CONFIG,
  bucketName,
  bucketTick,
  columnLabel,
  formatAxisMoney,
  formatMoney,
  niceTicks,
  plural,
  tickIndices,
} from "@/lib/spending"
import { cn } from "@/lib/utils"

/** Y-axis column width; the overlay and the x labels start after it. */
const AXIS_W = 56
/** Plot inset above and below, shared by Recharts' margin and the overlay. */
const INSET = 8
/** 23% gap on each side of a band leaves a 54% bar, as in the mockup. */
const CATEGORY_GAP = "23%"

/** One-line axis label ("GH₵ 4k"); Recharts' default tick wraps narrow text. */
function AxisTick({ x, y, payload }: Readonly<{ x?: number | string; y?: number | string; payload?: { value: number } }>) {
  return (
    <text x={Number(x) - 8} y={y} dy={4} textAnchor="end" fontSize={11} className="fill-muted-foreground">
      {formatAxisMoney(payload?.value ?? 0)}
    </text>
  )
}

export default function SpendingOverTimeChart({
  series,
  bucket,
  reducedMotion,
}: Readonly<{
  series: SpendingAnalytics["series"]
  bucket: SpendingAnalytics["bucket"]
  reducedMotion: boolean
}>) {
  const data = useMemo(() => series.map((p) => ({ ...p, value: Number(p.netSpent) || 0 })), [series])
  const max = data.reduce((m, p) => Math.max(m, p.value), 0)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const highest = max > 0 ? data.findIndex((p) => p.value === max) : -1

  const [active, setActive] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState(() => Math.max(0, data.length - 1))
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const maxLabels = bucket === "month" ? 12 : bucket === "week" ? 7 : 6
  const shown = new Set(tickIndices(data.length, maxLabels))
  const phoneShown = new Set(tickIndices(data.length, bucket === "month" ? 6 : 4))

  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = i
    if (e.key === "ArrowRight") next = Math.min(data.length - 1, i + 1)
    else if (e.key === "ArrowLeft") next = Math.max(0, i - 1)
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = data.length - 1
    else return
    e.preventDefault()
    setFocusIndex(next)
    buttons.current[next]?.focus()
  }

  const pct = (v: number) => (v / top) * 100

  return (
    <div>
      <div className="relative h-[200px] sm:h-[248px]">
        <ChartContainer
          config={OVER_TIME_CHART_CONFIG}
          aria-hidden="true"
          className="pointer-events-none aspect-auto h-full w-full"
        >
          <BarChart
            data={data}
            margin={{ top: INSET, right: 0, bottom: INSET, left: 0 }}
            barCategoryGap={CATEGORY_GAP}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} strokeDasharray="0" />
            <YAxis
              width={AXIS_W}
              domain={[0, top]}
              ticks={ticks}
              axisLine={false}
              tickLine={false}
              tick={AxisTick}
            />
            <XAxis dataKey="bucketStart" hide padding={{ left: 0, right: 0 }} />
            <Bar
              dataKey="value"
              fill="var(--color-c1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={38}
              isAnimationActive={!reducedMotion}
              animationBegin={120}
              animationDuration={640}
              animationEasing="ease-out"
            >
              {data.map((p, i) => (
                <Cell key={p.bucketStart} fillOpacity={active === null || active === i ? 1 : 0.4} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <div
          role="group"
          aria-label={`Spending over time, one column per ${bucket}`}
          className="absolute bottom-0 right-0 top-0 flex"
          style={{ left: AXIS_W, top: INSET, bottom: INSET }}
        >
          {data.map((p, i) => {
            const h = pct(p.value)
            const isActive = active === i
            const edge = i < 2 ? "left-0" : i > data.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
            return (
              <button
                key={p.bucketStart}
                ref={(el) => {
                  buttons.current[i] = el
                }}
                type="button"
                tabIndex={i === focusIndex ? 0 : -1}
                aria-label={columnLabel(p, bucket)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((a) => (a === i ? null : a))}
                onFocus={() => {
                  setActive(i)
                  setFocusIndex(i)
                }}
                onBlur={() => setActive((a) => (a === i ? null : a))}
                onKeyDown={(e) => move(e, i)}
                className={cn("group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end outline-none", isActive && "z-10")}
              >
                {p.value === 0 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "block h-[3px] w-[54%] max-w-[38px] rounded-full bg-muted-foreground/40",
                      isActive && "ring-2 ring-[var(--chart-1)] ring-offset-2 ring-offset-card",
                    )}
                  />
                ) : null}
                {isActive && p.value > 0 ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-0 w-[54%] max-w-[38px] rounded-t-[4px] ring-2 ring-[var(--chart-1)] ring-offset-2 ring-offset-card"
                    style={{ height: `${h}%` }}
                  />
                ) : null}
                {i === highest && !isActive ? (
                  <span
                    aria-hidden="true"
                    className="tnum pointer-events-none absolute hidden whitespace-nowrap text-[11px] font-medium tabular-nums text-foreground sm:block"
                    style={{ bottom: `calc(${h}% + 6px)` }}
                  >
                    GH₵ {Math.round(p.value).toLocaleString("en-GB")}
                  </span>
                ) : null}
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute w-max rounded-lg border border-border bg-card px-3 py-2 text-left shadow-[0_8px_24px_-8px_rgb(0_0_0/0.25)]",
                      edge,
                    )}
                    style={{ bottom: `calc(${h}% + 12px)` }}
                  >
                    <span className="tnum block text-sm font-semibold tabular-nums text-foreground">{formatMoney(p.netSpent)}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-0.5 w-3 rounded bg-[var(--chart-1)]" />
                      {bucketName(p.bucketStart, bucket, true)}, {plural(p.count, "payment")}
                    </span>
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div aria-hidden="true" className="mt-2 flex" style={{ marginLeft: AXIS_W }}>
        {data.map((p, i) => {
          const tick = bucketTick(p.bucketStart, bucket, i)
          return (
            <div
              key={p.bucketStart}
              className={cn(
                "min-w-0 flex-1 text-center text-[11px] leading-tight text-muted-foreground",
                !phoneShown.has(i) && "max-sm:invisible",
                !shown.has(i) && "sm:invisible",
              )}
            >
              <span className="block whitespace-nowrap">{tick.main}</span>
              {tick.sub ? <span className="block whitespace-nowrap text-foreground/70">{tick.sub}</span> : <span className="block">&nbsp;</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
