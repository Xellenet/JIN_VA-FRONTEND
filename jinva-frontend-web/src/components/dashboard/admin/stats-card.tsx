import type React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  icon: React.ReactNode
  title: string
  value: string | number
  subtitle: string
  trend?: number
  trendLabel?: string
}

export function StatsCard({ icon, title, value, subtitle, trend, trendLabel }: StatsCardProps) {
  const isPositive = trend !== undefined && trend > 0
  const isNegative = trend !== undefined && trend < 0

  return (
    <Card>
      <CardContent className="p-5">
        {/* Top row — label + icon */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground leading-snug">{title}</p>
          <div className="shrink-0 rounded-full bg-muted p-2">{icon}</div>
        </div>

        {/* Number */}
        <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</div>

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
