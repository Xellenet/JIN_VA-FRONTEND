import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export type RatingStarsSize = "dense" | "sm" | "md" | "lg"

const STAR_SIZE_CLASSES: Record<RatingStarsSize, string> = {
  dense: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
}

const NUMERAL_SIZE_CLASSES: Record<RatingStarsSize, string> = {
  dense: "text-xs",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-xl",
}

const GAP_CLASSES: Record<RatingStarsSize, string> = {
  dense: "gap-1",
  sm: "gap-1",
  md: "gap-1.5",
  lg: "gap-2",
}

export interface RatingStarsProps {
  /** Plain average rating (or an exact per-review rating), 0–5. Never the Bayesian-weighted score. */
  rating: number
  /**
   * Total review count backing this rating. Pass `0` explicitly to trigger the
   * "No ratings yet" empty state. Omit entirely (`undefined`) for a per-review
   * exact star row (admin table, individual review cards) where "count" has
   * no meaning and the empty-state check should never fire.
   */
  totalReviews?: number
  /**
   * When false, a `totalReviews === 0` artisan renders a real `0.0 (0)` row
   * instead of "No ratings yet" — for cards that keep the rating in a fixed
   * badge slot, where swapping in text would move it and reflow the card.
   * Default true.
   */
  showEmptyState?: boolean
  size?: RatingStarsSize
  /** Show the numeral (e.g. "4.6") next to the stars. Default true. */
  showValue?: boolean
  /** Show the "(N)" review count next to the numeral. Default true when totalReviews is known. */
  showCount?: boolean
  className?: string
}

/**
 * Shared proportional-fill star row — design-spec.md §2. Five muted stars,
 * each with a filled copy on top clipped to that star's share of the rating,
 * so a 4.6 renders as 4 full stars plus a 60%-clipped 5th star instead of one
 * static icon + a decimal.
 *
 * Always renders the review count alongside the numeral when known (never a
 * bare number), and shows a "No ratings yet" state instead of `0.0 ★★★★★`
 * when `totalReviews === 0` (unless `showEmptyState` is false). This is the plain average (`R`) only — the
 * Bayesian-weighted score (`WR`) is a backend-only sorting input and is never
 * rendered anywhere (see api-contract.md §8).
 *
 * The gold star uses the `--rating` token rather than a `yellow-400` literal
 * (DT5 / requirements.md Open Question 2, answered "token, not allowlist"). A
 * gold star is a convention rather than a status, so it gets its own token —
 * which is also what makes it tunable in dark mode.
 */
export function RatingStars({
  rating,
  totalReviews,
  showEmptyState = true,
  size = "md",
  showValue = true,
  showCount = true,
  className,
}: Readonly<RatingStarsProps>) {
  if (totalReviews === 0 && showEmptyState) {
    return (
      <span className={cn("text-xs italic text-muted-foreground", className)}>
        No ratings yet
      </span>
    )
  }

  const clampedRating = Math.max(0, Math.min(5, Number(rating) || 0))
  const starSize = STAR_SIZE_CLASSES[size]

  const label =
    totalReviews != null
      ? `${clampedRating.toFixed(1)} out of 5 stars, ${totalReviews} review${totalReviews === 1 ? "" : "s"}`
      : `${clampedRating.toFixed(1)} out of 5 stars`

  return (
    <span className={cn("inline-flex items-center", GAP_CLASSES[size], className)} aria-label={label}>
      {/*
        Each star is filled on its own, by its own share of the rating. One
        clipped overlay across the whole row looked right only at whole
        numbers: its flex children shrank to fit the clip (a 4.5 squeezed five
        gold stars into 90% of the width) and the gaps skewed the percentage,
        so gold drifted off the grey stars underneath.
      */}
      <span className="flex shrink-0 gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => {
          const starFill = Math.max(0, Math.min(1, clampedRating - i)) * 100
          return (
            <span key={i} className="relative inline-flex shrink-0">
              <Star className={cn(starSize, "shrink-0 text-muted-foreground/30")} />
              {starFill > 0 && (
                <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${starFill}%` }}>
                  <Star className={cn(starSize, "shrink-0 fill-rating text-rating")} />
                </span>
              )}
            </span>
          )
        })}
      </span>
      {showValue && (
        <span className={cn("font-semibold text-foreground", NUMERAL_SIZE_CLASSES[size])}>
          {clampedRating.toFixed(1)}
        </span>
      )}
      {showCount && totalReviews != null && (
        <span className="text-xs font-normal text-muted-foreground">({totalReviews})</span>
      )}
    </span>
  )
}
