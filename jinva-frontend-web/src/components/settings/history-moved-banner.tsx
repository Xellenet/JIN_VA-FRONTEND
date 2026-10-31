"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Wallet, X } from "lucide-react"

/** SEC-33: the only browser storage item 5 adds is this boolean flag. */
const DISMISSED_KEY = "jinva:payments-history-moved-dismissed"
const SHOW_FOR_MS = 60 * 24 * 60 * 60 * 1000

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * Q11: shown for 60 days after `NEXT_PUBLIC_SPENDING_RELEASED_AT`, or until
 * dismissed. With the variable unset (or invalid) it shows until dismissed.
 */
function withinWindow(now: number): boolean {
  const raw = process.env.NEXT_PUBLIC_SPENDING_RELEASED_AT
  if (!raw) return true
  const releasedAt = Date.parse(raw)
  if (Number.isNaN(releasedAt)) return true
  return now < releasedAt + SHOW_FOR_MS
}

/** FR-5.1: "Your payment history has moved to Spending". */
export function HistoryMovedBanner() {
  // Decided after mount: storage is not readable on the server.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(withinWindow(Date.now()) && !readDismissed())
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1")
    } catch {
      // Blocked storage: hidden for this visit only.
    }
  }

  return (
    <div
      role="region"
      aria-label="Payment history has moved"
      className="relative flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-4 sm:pr-14"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Wallet className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Your payment history has moved to Spending</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          See every payment, what it was for and who you paid, with totals by month.
        </p>
      </div>
      <Link
        href="/dashboard/user/report"
        className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-md border border-primary/30 bg-background px-3.5 text-sm font-medium text-primary outline-none hover:bg-primary/[0.06] focus-visible:ring-2 focus-visible:ring-primary sm:h-9 sm:w-auto dark:focus-visible:ring-ring"
      >
        Go to Spending
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary sm:right-2 sm:top-1/2 sm:h-10 sm:w-10 sm:-translate-y-1/2 dark:focus-visible:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
