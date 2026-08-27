"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { Button } from "@/components/ui/button"
import { CHART_TOOLTIP_STYLE, CHART_AXIS_TICK } from "@/lib/charts"

const data = [
  { month: "Jan", value: 8500 },
  { month: "Feb", value: 10200 },
  { month: "Mar", value: 14800 },
  { month: "Apr", value: 9200 },
  { month: "May", value: 11500 },
  { month: "Jun", value: 7800 },
  { month: "Jul", value: 13200 },
  { month: "Aug", value: 20000 },
  { month: "Sep", value: 12500 },
  { month: "Oct", value: 15200 },
  { month: "Nov", value: 17800 },
  { month: "Dec", value: 16400 },
]

/**
 * design-spec.md §0.4: every colour in here was an invalid
 * `hsl(var(--token))` string under this app's oklch/oklab tokens, so the bars
 * and the tooltip chrome were rendering as SVG-default black / unstyled. Now
 * on the bare-token form.
 *
 * The bar was nominally `--muted`, which resolves to `oklch(0.97 0 0)` — a
 * near-white bar on a white card, i.e. invisible the moment the token is
 * actually applied. It uses `--primary` here instead, matching the only one of
 * this widget's two legend entries that corresponds to a real concept on this
 * marketplace. The widget as a whole (hardcoded months, "Product"/"Service"
 * legends, dead "Last Year" button) is slated for replacement by the real
 * gross-vs-net revenue chart — design-spec.md §10.3.
 */
export function RevenueChart() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Revenue Growth Trend</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-full bg-muted"></div>
              <span className="text-muted-foreground">Product</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-full bg-primary"></div>
              <span className="text-muted-foreground">Service</span>
            </div>
            <Button variant="outline" size="sm" className="h-8 bg-transparent">
              Last Year
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-xs" tick={CHART_AXIS_TICK} />
            <YAxis axisLine={false} tickLine={false} className="text-xs" tick={CHART_AXIS_TICK} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
