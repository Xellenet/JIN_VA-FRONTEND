import type React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The app's single KPI stat card — design-spec.md §2.3.
 *
 * Two `iconTone` values and two `size` values were added so the analytics
 * screens can use this component instead of the inline copy each of them had
 * grown (icon in a tinted circle, `text-2xl` value). Both prop values are
 * tints already in use elsewhere (`bg-muted`, `bg-primary/10`) — nothing new
 * is invented, and the meaningless third tint (`bg-primary/20`, used only for
 * "Avg Rating") is deliberately not offered.
 *
 * Honesty rule that outranks everything else here: the trend chip renders
 * *only* when a `trend` is passed. No `trend` prop → no arrow, no percentage.
 * A trend must come from a real prior-period comparison returned by the API,
 * never from a literal.
 */
interface StatsCardProps {
  icon: React.ReactNode
  title: string
  value: string | number
  subtitle: string
  trend?: number
  trendLabel?: string
  /** Icon circle tint. `"muted"` (default) or `"primary"`. */
  iconTone?: "muted" | "primary"
  /** Value type scale — `"lg"` (default, `text-3xl`) or `"md"` (`text-2xl`). */
  size?: "lg" | "md"
}

export function StatsCard({
  icon,
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  iconTone = "muted",
  size = "lg",
}: Readonly<StatsCardProps>) {
  const isPositive = trend !== undefined && trend > 0
  const isNegative = trend !== undefined && trend < 0

  return (
    <Card>
      <CardContent className="p-5">
        {/* Top row — label + icon */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground leading-snug">{title}</p>
          <div
            className={cn(
              "shrink-0 rounded-full p-2",
              iconTone === "primary" ? "bg-primary/10" : "bg-muted",
            )}
          >
            {icon}
          </div>
        </div>

        {/* Number */}
        <div
          className={cn(
            "mt-3 font-bold tracking-tight text-foreground",
            size === "md" ? "text-2xl" : "text-3xl",
          )}
        >
          {value}
        </div>

        {/* Subtitle + trend */}
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          {trend !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                isPositive && "text-primary",
                isNegative && "text-destructive",
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {trendLabel ?? `${trend > 0 ? "+" : ""}${trend}`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
