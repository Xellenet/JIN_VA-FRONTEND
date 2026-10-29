"use client"

import { useEffect, useRef, useState } from "react"

interface UseRevealOnScrollOptions {
  /** Fraction of the element that must be visible before it reveals. */
  threshold?: number
  /** Observer root margin. The default trims the bottom of the viewport a
   *  little so an element reveals just after it starts entering, not the
   *  instant its first pixel crosses the fold. */
  rootMargin?: string
}

/**
 * One-shot "has this entered the viewport yet?" hook, backing the `<Reveal>`
 * wrapper in src/components/public/reveal.tsx.
 *
 * Plain IntersectionObserver, no animation library — the actual fade and lift
 * live in `globals.css` under `[data-reveal]`, so this hook only ever flips a
 * boolean. Once revealed it disconnects and never re-hides: content that scrolls
 * back out of view stays put rather than flickering.
 *
 * Accessibility: `prefers-reduced-motion` is handled in CSS rather than here, on
 * purpose. The hidden state only exists inside a
 * `@media (prefers-reduced-motion: no-preference) and (scripting: enabled)`
 * block, so a reduced-motion visitor gets the content immediately no matter what
 * this hook does or when it runs. Same for a visitor with JS off. That ordering
 * matters: a reveal that needs JS to un-hide content must never be the thing
 * that decides whether the content is visible at all.
 */
export function useRevealOnScroll<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.12,
  rootMargin = "0px 0px -8% 0px",
}: UseRevealOnScrollOptions = {}) {
  const ref = useRef<T | null>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (revealed) return
    const node = ref.current
    if (!node) return

    // Older browsers, or anything that has already scrolled past: just show it.
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [revealed, threshold, rootMargin])

  return { ref, revealed }
}
