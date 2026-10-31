"use client"

/**
 * Small pieces shared by the Spending page's cards (design/spending/spec.md §3).
 * Server text (job titles, service and artisan names) is only ever rendered as
 * a text node with `dir="auto"` and bidi isolation (SEC-17, SEC-21).
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { AlertCircle, BarChart3, Building2, CreditCard, RefreshCw, Smartphone, Table2, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getCustomerPaymentStatusConfig } from "@/lib/status-badges"
import { initials, methodKey, retryLabel, spendingStatusLabel, type MethodKey } from "@/lib/spending"
import { cn, resolveAvatarUrl } from "@/lib/utils"

/** Q-X1: the focus ring for every new control. */
export const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-ring"

/** Keeps focused rows clear of the 56px sticky top bar (WCAG 2.4.11). */
export const SCROLL_MARGIN = "scroll-mt-[72px]"

/** User-supplied text: isolated direction, wraps instead of overflowing. */
export function UserText({ children, className }: Readonly<{ children: string; className?: string }>) {
  return (
    <span dir="auto" className={cn("[unicode-bidi:isolate] break-words", className)}>
      {children}
    </span>
  )
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (!query) return
    setReduced(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])
  return reduced
}

/** Counts down from `seconds` (a 429's Retry-After) to 0, once a second. */
export function useCountdown(seconds: number, key: unknown): number {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    if (seconds <= 0) return
    const started = Date.now()
    const id = window.setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000))
      setLeft(remaining)
      if (remaining === 0) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [seconds, key])
  return left
}

export const METHOD_ICONS: Record<MethodKey, typeof Smartphone> = {
  mobile_money: Smartphone,
  card: CreditCard,
  bank: Building2,
  other: Wallet,
}

export function MethodIcon({ channel, className }: Readonly<{ channel: string | null; className?: string }>) {
  const Icon = METHOD_ICONS[methodKey(channel)]
  return <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-muted-foreground", className)} />
}

/** Payment status pill: existing customer colours and icons, Spending labels (FU-4.4). */
export function StatusPill({ status }: Readonly<{ status: string }>) {
  const config = getCustomerPaymentStatusConfig(status)
  const Icon = config.icon
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        config.className || "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
      {spendingStatusLabel(status)}
    </span>
  )
}

export function ArtisanAvatar({
  name,
  avatar,
  className,
}: Readonly<{ name: string; avatar: string | null; className?: string }>) {
  const src = resolveAvatarUrl(avatar)
  return (
    <Avatar className={cn("h-9 w-9 shrink-0", className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="bg-muted text-xs font-semibold text-foreground/80">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

/** Chart / Table switch. Icon-only on phones with an aria-label; 44px targets there. */
export function ViewToggle({
  view,
  onChange,
  controls,
}: Readonly<{ view: "chart" | "table"; onChange: (v: "chart" | "table") => void; controls: string }>) {
  const items = [
    { value: "chart" as const, label: "Chart", aria: "Show as chart", Icon: BarChart3 },
    { value: "table" as const, label: "Table", aria: "Show as table", Icon: Table2 },
  ]
  return (
    <div role="group" aria-label="Show as" className="inline-flex shrink-0 rounded-lg bg-muted p-0.5">
      {items.map(({ value, label, aria, Icon }) => {
        const on = view === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            aria-controls={controls}
            aria-label={aria}
            onClick={() => onChange(value)}
            className={cn(
              FOCUS_RING,
              "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] sm:h-8 sm:min-w-0",
              on
                ? "bg-card font-medium text-foreground shadow-[0_0_0_1px_var(--border)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** A chart card: title, one-sentence summary, optional toggle, and the body. */
export function ChartCard({
  id,
  title,
  summary,
  toggle,
  footer,
  children,
  className,
}: Readonly<{
  id: string
  title: string
  summary: string
  toggle?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}>) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-card", className)}>
      <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="text-[15px] font-semibold text-foreground">
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            <UserText>{summary}</UserText>
          </p>
        </div>
        {toggle}
      </div>
      <div id={id} className="min-w-0 flex-1 px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
        {children}
      </div>
      {footer}
    </section>
  )
}

/** A plain table used by every chart's Table view (FR-4.9). Text only. */
export function DataTable({
  caption,
  columns,
  rows,
}: Readonly<{
  caption: string
  columns: { label: string; numeric?: boolean }[]
  rows: { key: string; cells: ReactNode[]; muted?: boolean }[]
}>) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
          {columns.map((c) => (
            <th key={c.label} scope="col" className={cn("pb-2 font-medium", c.numeric && "pl-4 text-right")}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-border/70 last:border-0">
            {r.cells.map((cell, i) => (
              <td
                key={i}
                className={cn(
                  "py-2.5 align-top",
                  columns[i]?.numeric && "tnum whitespace-nowrap pl-4 text-right tabular-nums",
                  r.muted && "text-muted-foreground",
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * FR-4.18: one block failed. `retryIn` > 0 is a 429: the button waits out the
 * Retry-After seconds with a visible countdown, and never retries by itself.
 */
export function LoadError({
  title,
  body,
  onRetry,
  retryIn,
  attempt,
  className,
}: Readonly<{
  title: string
  body: string
  onRetry: () => void
  retryIn: number
  attempt: number
  className?: string
}>) {
  const left = useCountdown(retryIn, attempt)
  return (
    <div role="alert" className={cn("flex flex-col gap-4 sm:flex-row sm:items-start", className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle aria-hidden="true" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
          {retryIn > 0 ? "Too many requests, please wait a moment." : body}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className={cn(FOCUS_RING, "h-11 shrink-0 self-start sm:h-10")}
        onClick={onRetry}
        disabled={left > 0}
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        <span className="tnum tabular-nums">{retryLabel(left)}</span>
      </Button>
    </div>
  )
}

/** Skeleton block: final size, pulse stops under reduced motion (FR-4.15). */
export function Shimmer({ className, style }: Readonly<{ className?: string; style?: CSSProperties }>) {
  return <div aria-hidden="true" style={style} className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)} />
}
