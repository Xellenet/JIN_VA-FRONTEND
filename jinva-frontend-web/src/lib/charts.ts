/**
 * Shared Recharts theming — design-spec.md §0.4 and §0.5.
 *
 * Two problems this module fixes, both of which had been copy-pasted across
 * `admin/analytics/page.tsx`, `artisan/analytics/page.tsx` and
 * `dashboard/admin/revenue-chart.tsx`:
 *
 * 1. **The colours were invalid CSS and silently discarded.** Every chart
 *    passed Recharts strings like `hsl(var(--primary))` and
 *    `backgroundColor: "hsl(var(--card))"`. Under Tailwind 4 the tokens in
 *    `globals.css` are `oklch()` / `oklab()` values, not HSL triplets —
 *    `--primary` is literally `oklab(32.107% -0.04748 0.01739)`. So
 *    `hsl(var(--primary))` expanded to `hsl(oklab(…))`, which is not a colour,
 *    and every stroke/fill/tooltip background fell back to the SVG default
 *    (black) or to transparent. The charts on screen were never
 *    brand-coloured; they only looked plausible because black-on-white reads
 *    as "a chart". The correct form is the bare token — `var(--primary)`,
 *    `var(--border)`, `var(--card)`, `var(--chart-N)` — which is what these
 *    constants use. No new colour is introduced by the fix; this is the
 *    difference between the design tokens being applied and being thrown away.
 *
 * 2. **`TOOLTIP_STYLE` existed three times**, verbatim in two of them.
 *
 * Opacity variants deliberately use Recharts' `strokeOpacity`/`fillOpacity`
 * props rather than a colour function, since `var(--token) / 0.4` is not
 * valid inside a bare `var()` reference either.
 */

/** Recharts `<Tooltip contentStyle={…}>` — one definition for every chart. */
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,.1)",
  color: "var(--foreground)",
  fontSize: "12px",
} as const

/** Recharts `<XAxis tick={…}>` / `<YAxis tick={…}>`. */
export const CHART_AXIS_TICK = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
} as const

/** Recharts `<CartesianGrid stroke={…}>`. */
export const CHART_GRID_STROKE = "var(--border)"

/**
 * The five categorical series colours, for charts that need more than one
 * hue (e.g. a rating-distribution pie). These are the `--chart-1..5` tokens
 * `globals.css` already defines for exactly this purpose.
 */
export const CHART_SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const
