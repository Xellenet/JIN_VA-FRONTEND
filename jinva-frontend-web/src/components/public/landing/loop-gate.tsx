"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"

/**
 * Whether a looping animation in `ref` may run right now: motion is allowed,
 * the tab is visible and the element is on screen.
 *
 * `reduced` is `null` on the server and before mount (unknown), and `active`
 * is false until the browser has said motion is fine, so a JS loop never
 * starts early. CSS loops do not depend
 * on this; they are gated by their own media query in landing.css.
 */
export function useLoopActive<T extends HTMLElement>(ref: React.RefObject<T | null>, threshold = 0) {
  const [reduced, setReduced] = useState<boolean | null>(null)
  const [inView, setInView] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onMotion = () => setReduced(mq.matches)
    onMotion()
    mq.addEventListener("change", onMotion)

    const onVisibility = () => setPageVisible(document.visibilityState === "visible")
    onVisibility()
    document.addEventListener("visibilitychange", onVisibility)

    const node = ref.current
    let observer: IntersectionObserver | null = null
    if (node && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => setInView(entries.some((e) => e.isIntersecting)),
        { threshold },
      )
      observer.observe(node)
    } else {
      setInView(true)
    }

    return () => {
      mq.removeEventListener("change", onMotion)
      document.removeEventListener("visibilitychange", onVisibility)
      observer?.disconnect()
    }
  }, [ref, threshold])

  return { reduced, inView, pageVisible, active: reduced === false && inView && pageVisible }
}

/**
 * Wraps a region of CSS loops (photo columns, the trades strip, the floating
 * cards) and sets `data-paused="true"` on it while it is off-screen or the tab
 * is hidden, which landing.css turns into `animation-play-state: paused`.
 *
 * Children stay server-rendered; this only adds one attribute.
 */
export function LoopGate({
  as: Tag = "div",
  children,
  ...props
}: Readonly<{ as?: "div" | "section" } & React.HTMLAttributes<HTMLElement>>) {
  const ref = useRef<HTMLElement | null>(null)
  const { inView, pageVisible } = useLoopActive(ref)
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      data-paused={inView && pageVisible ? "false" : "true"}
      {...props}
    >
      {children}
    </Tag>
  )
}
