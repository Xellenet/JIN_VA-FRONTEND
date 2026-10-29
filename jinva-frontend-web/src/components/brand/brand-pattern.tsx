"use client"

import { useId } from "react"
import { cn } from "@/lib/utils"

/**
 * The JinVa brand-surface texture: a 40px grid plus a 20px dot field, drawn in
 * `currentColor` at 10% opacity over the `from-brand to-brand-accent` gradient.
 *
 * Extracted out of `auth-split-layout.tsx` (design-spec.md §1.2 / DT4) because
 * the landing page needs it twice — the hero panel and the final CTA band — and
 * the auth layout needs it once. Three copies of the same `<defs>` block in one
 * document is a real, silent bug: SVG `id`s are document-global, so the second
 * and third `url(#grid)` references resolve to the FIRST pattern definition.
 * `useId()` gives every instance its own ids, so the composition is safe to
 * repeat as many times as a page wants.
 *
 * `useId()` is a client hook, hence "use client" — this is a purely decorative
 * island with no state and no event handlers.
 *
 * Renders as an absolutely-positioned overlay, so the parent needs
 * `relative overflow-hidden`. It is `aria-hidden` and pointer-transparent:
 * decoration only, never content.
 */
export function BrandPattern({ className }: { readonly className?: string }) {
  // useId() emits characters that are awkward inside a url(#…) reference
  // (":" in React 18, guillemets in React 19), so reduce it to a safe slug.
  const rawId = useId()
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "")
  const gridId = `brand-grid-${uid}`
  const dotsId = `brand-dots-${uid}`

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 text-brand-foreground opacity-10",
        className,
      )}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={gridId} width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
          <pattern id={dotsId} width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${gridId})`} />
        <rect width="100%" height="100%" fill={`url(#${dotsId})`} />
      </svg>
    </div>
  )
}
