"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { CHART_TOOLTIP_STYLE, CHART_AXIS_TICK, CHART_GRID_STROKE } from "@/lib/charts"
import { formatCurrency } from "@/lib/utils"

/**
 * QA ADM-02: platform fees received per day, from the analytics rollup. This
 * used to be twelve made-up months with "Product"/"Service" legends and a
 * "Last Year" button that did nothing.
 */
export function RevenueChart({
  series,
  total,
  periodLabel,
}: {
  /** `null` when the rollup couldn't compute revenue: unavailable, not zero. */
  series: Array<{ label: string; net: number }> | null
  total: number | null
  periodLabel: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-lg font-semibold">Platform Fees Received</CardTitle>
          {total != null && (
            <p className="text-sm text-muted-foreground">
              {formatCurrency(total)} in the {periodLabel}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {series == null || total == null ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Revenue couldn&apos;t be loaded right now.</p>
        ) : total === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No payments received in the {periodLabel}.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} minTickGap={12} />
              <YAxis axisLine={false} tickLine={false} tick={CHART_AXIS_TICK} width={56} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value) => [formatCurrency(Number(value)), "Platform fees"]}
              />
              <Bar dataKey="net" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
