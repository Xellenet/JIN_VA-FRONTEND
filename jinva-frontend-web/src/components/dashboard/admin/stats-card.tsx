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
  const isPositive = trend && trend > 0
  const isNegative = trend && trend < 0

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-muted p-2">{icon}</div>
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
            </div>
          </div>
          {trend !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                isPositive && "text-green-600",
                isNegative && "text-red-600",
              )}
            >
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {trendLabel || `${trend > 0 ? "+" : ""}${trend}`}
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="text-3xl font-bold">{value}</div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  )
}
