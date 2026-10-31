"use client"

import { useId } from "react"
import type { Money } from "@/lib/customer-api"
import { monthName, sparklineAlt, sparklineGeometry } from "@/lib/overview"

/**
 * Six-month spending sparkline: plain inline SVG, no chart library on the
 * Overview (NFR-1.2). `role="img"` with the FR-2.6 text alternative; the month
 * labels are decorative.
 */
export function Sparkline({ series }: { series: readonly { month: string; netSpent: Money }[] }) {
  const gradientId = useId()
  const geometry = sparklineGeometry(series.map((p) => Number(p.netSpent)))
  if (!geometry) return null

  return (
    <figure className="mt-4">
      <svg
        viewBox="0 0 280 64"
        preserveAspectRatio="none"
        role="img"
        aria-label={sparklineAlt(series)}
        className="h-16 w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2="280" y1="60" y2="60" stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={geometry.area} fill={`url(#${gradientId})`} />
        <path
          d={geometry.line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* The end dot is HTML so it stays round when the SVG stretches. */}
      <div className="relative h-0">
        <span
          aria-hidden
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
          style={{ left: `${geometry.last.x * 100}%`, top: `${(geometry.last.y - 1) * 64}px` }}
        />
      </div>
      <figcaption aria-hidden className="mt-2 grid grid-cols-6 text-[11px] text-muted-foreground">
        {series.map((p, i) => (
          <span
            key={p.month}
            className={i === 0 ? "text-left" : i === series.length - 1 ? "text-right font-medium text-foreground" : "text-center"}
          >
            {monthName(p.month, { short: true })}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
