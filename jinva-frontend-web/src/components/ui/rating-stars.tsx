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
  size?: RatingStarsSize
  /** Show the numeral (e.g. "4.6") next to the stars. Default true. */
  showValue?: boolean
  /** Show the "(N)" review count next to the numeral. Default true when totalReviews is known. */
  showCount?: boolean
  className?: string
}

/**
 * Shared proportional-fill star row — design-spec.md §2. A muted background
 * row of 5 stars with an identical filled foreground row clipped to
 * `rating/5` width layered on top, so a 4.6 renders as 4 full stars plus a
 * 60%-clipped 5th star instead of one static icon + a decimal.
 *
 * Always renders the review count alongside the numeral when known (never a
 * bare number), and shows a "No ratings yet" state instead of `0.0 ★★★★★`
 * when `totalReviews === 0`. This is the plain average (`R`) only — the
 * Bayesian-weighted score (`WR`) is a backend-only sorting input and is never
 * rendered anywhere (see api-contract.md §8).
 */
export function RatingStars({
  rating,
  totalReviews,
  size = "md",
  showValue = true,
  showCount = true,
  className,
}: Readonly<RatingStarsProps>) {
  if (totalReviews === 0) {
    return (
      <span className={cn("text-xs italic text-muted-foreground", className)}>
        No ratings yet
      </span>
    )
  }

  const clampedRating = Math.max(0, Math.min(5, Number(rating) || 0))
  const fillPercent = (clampedRating / 5) * 100
  const starSize = STAR_SIZE_CLASSES[size]

  const label =
    totalReviews != null
      ? `${clampedRating.toFixed(1)} out of 5 stars, ${totalReviews} review${totalReviews === 1 ? "" : "s"}`
      : `${clampedRating.toFixed(1)} out of 5 stars`

  return (
    <span className={cn("inline-flex items-center", GAP_CLASSES[size], className)} aria-label={label}>
      <span className="relative inline-flex shrink-0" aria-hidden="true">
        <span className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn(starSize, "text-muted-foreground/30")} />
          ))}
        </span>
        <span
          className="absolute inset-0 flex gap-0.5 overflow-hidden whitespace-nowrap"
          style={{ width: `${fillPercent}%` }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn(starSize, "fill-yellow-400 text-yellow-400")} />
          ))}
        </span>
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
