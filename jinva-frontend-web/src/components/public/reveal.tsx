"use client"

import type React from "react"
import { Slot } from "@radix-ui/react-slot"
import { useRevealOnScroll } from "@/hooks/use-reveal-on-scroll"

interface RevealProps extends Omit<React.ComponentProps<"div">, "ref"> {
  /**
   * Render the reveal state onto the single child element instead of wrapping it
   * in a `<div>`. Useful inside grids, where an extra wrapper would become the
   * grid item.
   */
  asChild?: boolean
  /** Stagger, in milliseconds. Keep grids under ~400ms total. */
  delay?: number
  /**
   * `"lift"` (default) fades in and rises 1rem. `"fade"` is opacity-only — use
   * it on anything whose `transform` is already doing something (a rotated card,
   * a `hover:scale`), since the two would otherwise fight.
   */
  variant?: "lift" | "fade"
}

/**
 * Fades a section or card in as it scrolls into view, with an optional stagger.
 *
 * All the motion is CSS (see the `[data-reveal]` block in globals.css); this
 * component only supplies the `data-revealed` flag and the `--reveal-delay`
 * custom property. `prefers-reduced-motion` and JS-disabled are both handled by
 * the media query guarding that CSS, so neither depends on this component
 * behaving correctly.
 */
export function Reveal({
  asChild = false,
  delay = 0,
  variant = "lift",
  className,
  style,
  children,
  ...props
}: Readonly<RevealProps>) {
  const { ref, revealed } = useRevealOnScroll<HTMLDivElement>()
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      ref={ref}
      data-reveal={variant === "fade" ? "fade" : ""}
      data-revealed={revealed ? "true" : undefined}
      className={className}
      style={
        delay
          ? ({ ...style, "--reveal-delay": `${delay}ms` } as React.CSSProperties)
          : style
      }
      {...props}
    >
      {children}
    </Comp>
  )
}
