/**
 * HB1 — the header icon unread badge.
 *
 * Reuses the exact circular unread-count idiom already used for conversation
 * rows in `messages-page.tsx` (bg-primary / text-primary-foreground, capped at
 * "9+"), repositioned for the smaller 32px header icon button.
 *
 * Renders nothing at all when the count is zero — no dot, no "0". Silence is
 * the correct signal (design-spec.md section 10).
 */
export function HeaderIconBadge({ count }: Readonly<{ count: number }>) {
  if (count <= 0) return null
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-1 ring-background">
      {count > 9 ? "9+" : count}
    </span>
  )
}

/**
 * Header badge poll cadence. design-spec.md section 8.1 lands on ~30s for the
 * header badge — deliberately lighter than the 8s in-open-thread precedent,
 * since this runs on every dashboard page.
 */
export const POPOVER_POLL_MS = 30_000

/** Both dropdowns preview at most 5 rows (design-spec.md section 3). */
export const PREVIEW_ROW_LIMIT = 5
