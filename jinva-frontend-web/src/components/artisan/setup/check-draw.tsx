import { cn } from "@/lib/utils"

/**
 * A ring and a check that draw themselves once (`[data-check-draw]` in
 * globals.css). Under reduced motion both are simply there. Decorative: the
 * words next to it say what happened.
 */
export function CheckDraw({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={cn("h-12 w-12 text-success", className)}>
      <circle cx="24" cy="24" r="21" className="stroke-success/20" strokeWidth="3" />
      <circle
        cx="24"
        cy="24"
        r="21"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={1}
        transform="rotate(-90 24 24)"
        data-check-draw=""
      />
      <path
        d="M15 24.5l6 6 12-13"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        data-check-draw=""
        style={{ "--reveal-delay": "380ms" } as React.CSSProperties}
      />
    </svg>
  )
}
