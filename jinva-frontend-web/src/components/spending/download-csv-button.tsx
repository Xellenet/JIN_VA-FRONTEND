"use client"

/**
 * FR-4.14 "Download CSV": fetches B10 with the current filters through the
 * shared client, hands the browser an object URL named by `csvFileName()`, and
 * revokes it. Toasts for the start, the range cap (400) and the rate limit
 * (429, no automatic retry).
 */
import { useState } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api"
import { downloadPaymentHistoryCsv, isRateLimited, type PaymentHistoryFilters } from "@/lib/customer-api"
import { csvFileName } from "@/lib/spending"
import { cn } from "@/lib/utils"
import { FOCUS_RING } from "./shared"

const RANGE_MESSAGE = "Narrow the date range to 24 months or less, then download again."

export function DownloadCsvButton({ filters }: Readonly<{ filters: PaymentHistoryFilters }>) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    if (busy) return
    setBusy(true)
    try {
      const blob = await downloadPaymentHistoryCsv(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = csvFileName()
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
      toast.success("Your download has started")
    } catch (err) {
      if (isRateLimited(err)) toast.error("Too many requests, please wait a moment.")
      else if (err instanceof ApiError && err.status === 400) toast.error(RANGE_MESSAGE)
      else toast.error("Couldn't download your payments. Check your connection, then try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      aria-busy={busy}
      aria-label="Download CSV"
      className={cn(
        FOCUS_RING,
        "inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted sm:h-9 sm:w-auto sm:px-3",
        busy && "cursor-progress opacity-80",
      )}
    >
      {busy ? <Spinner className="h-4 w-4" /> : <Download aria-hidden="true" className="h-4 w-4" />}
      <span className="hidden sm:inline">Download CSV</span>
    </button>
  )
}
