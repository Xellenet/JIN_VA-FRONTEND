"use client"

import { useId, type ReactNode } from "react"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type RailLayout = "rail" | "cards"

/** One rail section's state. `ready` data may itself be null (e.g. no upcoming booking). */
export type RailSectionState<T> =
  | { kind: "loading" }
  | { kind: "error"; rateLimited: boolean }
  | { kind: "ready"; data: T }

export const railFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"

/**
 * A rail section. In the ≥1280px rail it is a slice of one tinted panel
 * (split by the panel's hairlines); below that it is its own bordered card.
 */
export function RailSection({
  title,
  aside,
  layout,
  name,
  children,
  className,
}: {
  title: string
  aside?: ReactNode
  layout: RailLayout
  name: string
  children: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section
      data-rail={name}
      aria-labelledby={id}
      className={cn("p-4 sm:p-5", layout === "cards" && "rounded-2xl border bg-card", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** "Couldn't load … · Try again", or the 429 wait message without a button (SEC-25). */
export function RailError({
  message,
  rateLimited,
  onRetry,
}: {
  message: string
  rateLimited: boolean
  onRetry: () => void
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-destructive" />
        {rateLimited ? "Too many requests, please wait a moment" : message}
      </p>
      {!rateLimited && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-sm font-medium text-foreground underline underline-offset-4 sm:min-h-8",
            railFocusRing,
          )}
        >
          Try again
        </button>
      )}
    </div>
  )
}

/** A skeleton bar on the tinted rail (uses `--border` so it shows on `--muted`). */
export function RailSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-md bg-border/70 motion-safe:animate-pulse", className)} />
}
