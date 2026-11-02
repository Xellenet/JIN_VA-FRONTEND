"use client"

import { useCallback, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"
import { getBooking } from "@/lib/artisan-overview-api"
import { clientLabel, formatGhs, safeId } from "@/lib/artisan-overview"

/** What Accept/Decline need to know about a request. */
export interface RespondTarget {
  id: number
  clientName: string
  /**
   * The price the client agreed to. `undefined` = not known yet (it is fetched
   * before accepting); `null`/0 = none, so the artisan sets one (QA JOB-22).
   */
  agreedPrice?: string | number | null
}

const hasPrice = (p: string | number | null | undefined) => p != null && Number(p) > 0

/**
 * Accept and Decline for booking requests, shared by the Overview and the
 * Calendar so both behave the same:
 *
 * - Accept is one tap when the client already agreed a price (the card shows
 *   it). With no agreed price the artisan sets one first, because confirming
 *   creates the client's payment. When the price isn't known yet it is
 *   fetched, then confirmed in a dialog that shows it.
 * - Decline asks once: the client is told and it can't be undone.
 */
export function useBookingResponse({
  onAccepted,
  onDeclined,
}: {
  onAccepted: (id: number, result: { jobId: number | null; price: number | null }) => void
  onDeclined: (id: number) => void
}): {
  accept: (target: RespondTarget) => void
  decline: (target: RespondTarget) => void
  respondingId: number | null
  dialogs: ReactNode
} {
  const [respondingId, setRespondingId] = useState<number | null>(null)
  const [priceTarget, setPriceTarget] = useState<RespondTarget | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<RespondTarget | null>(null)
  const [declineTarget, setDeclineTarget] = useState<RespondTarget | null>(null)
  const [price, setPrice] = useState("")
  const [priceError, setPriceError] = useState<string | null>(null)

  const confirm = useCallback(
    async (target: RespondTarget, newPrice: number | null) => {
      const id = safeId(target.id)
      if (!id) return false
      setRespondingId(id)
      try {
        const result = await apiFetch<{ jobId?: number | null } | null>(`/bookings/${id}/confirm`, {
          method: "PATCH",
          body: JSON.stringify(newPrice != null ? { price: newPrice } : {}),
        })
        onAccepted(id, { jobId: safeId(result?.jobId), price: newPrice })
        toast.success(`Booking accepted. ${clientLabel(target.clientName)} pays before you start.`)
        return true
      } catch (err) {
        // The server already explains an expired request or a suspended account.
        toast.error(err instanceof Error ? err.message : "Couldn't accept this booking. Try again.")
        return false
      } finally {
        setRespondingId(null)
      }
    },
    [onAccepted],
  )

  const openPrice = (target: RespondTarget) => {
    setPrice("")
    setPriceError(null)
    setPriceTarget(target)
  }

  const accept = useCallback(
    (target: RespondTarget) => {
      if (respondingId != null) return
      if (hasPrice(target.agreedPrice)) {
        void confirm(target, null)
        return
      }
      if (target.agreedPrice !== undefined) {
        openPrice(target)
        return
      }
      setRespondingId(target.id)
      getBooking(target.id)
        .then((b) => {
          setRespondingId(null)
          const next = { ...target, agreedPrice: b.agreedPrice ?? null }
          if (hasPrice(next.agreedPrice)) setConfirmTarget(next)
          else openPrice(next)
        })
        .catch((err) => {
          setRespondingId(null)
          toast.error(err instanceof Error ? err.message : "Couldn't open this request. Try again.")
        })
    },
    [confirm, respondingId],
  )

  const decline = useCallback((target: RespondTarget) => setDeclineTarget(target), [])

  const submitPrice = async () => {
    if (!priceTarget) return
    const raw = price.trim()
    const error =
      raw === ""
        ? "Enter your price for this booking"
        : !/^\d+(\.\d{1,2})?$/.test(raw)
          ? "Use a number with up to 2 decimal places, like 150.50"
          : Number(raw) <= 0
            ? "Enter an amount above 0"
            : null
    setPriceError(error)
    if (error) return
    if (await confirm(priceTarget, Number(raw))) setPriceTarget(null)
  }

  const submitDecline = async () => {
    const target = declineTarget
    const id = safeId(target?.id)
    if (!target || !id) return
    setRespondingId(id)
    try {
      await apiFetch(`/bookings/${id}/decline`, { method: "PATCH", body: JSON.stringify({}) })
      onDeclined(id)
      toast.success("Request declined.")
      setDeclineTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't decline this request. Try again.")
    } finally {
      setRespondingId(null)
    }
  }

  const busy = respondingId != null

  const dialogs = (
    <>
      <AlertDialog open={priceTarget != null} onOpenChange={(open) => !open && !busy && setPriceTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set your price to accept</AlertDialogTitle>
            <AlertDialogDescription>
              {clientLabel(priceTarget?.clientName)} hasn&apos;t agreed a price for this booking. They pay your price
              through JinVa before you start.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="accept-price">Your price (GH₵)</Label>
            <Input
              id="accept-price"
              inputMode="decimal"
              autoComplete="off"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value)
                setPriceError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void submitPrice()
                }
              }}
              aria-invalid={priceError != null}
              aria-describedby={priceError ? "accept-price-error" : undefined}
              disabled={busy}
              className="h-11 sm:h-9"
            />
            {priceError && (
              <p id="accept-price-error" className="text-sm text-destructive">
                {priceError}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="h-11 sm:h-9">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void submitPrice()
              }}
              disabled={busy}
              className="h-11 sm:h-9"
            >
              {busy && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
              Accept booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmTarget != null} onOpenChange={(open) => !open && !busy && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {clientLabel(confirmTarget?.clientName)} agreed to {formatGhs(confirmTarget?.agreedPrice)}. They pay it
              through JinVa before you start.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="h-11 sm:h-9">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (confirmTarget) void confirm(confirmTarget, null).then((ok) => ok && setConfirmTarget(null))
              }}
              disabled={busy}
              className="h-11 sm:h-9"
            >
              {busy && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
              Accept booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={declineTarget != null} onOpenChange={(open) => !open && !busy && setDeclineTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline {clientLabel(declineTarget?.clientName)}&apos;s request?</AlertDialogTitle>
            <AlertDialogDescription>
              The client is told you can&apos;t take this booking. You can&apos;t undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="h-11 sm:h-9">
              Keep request
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void submitDecline()
              }}
              disabled={busy}
              className="h-11 bg-destructive text-white hover:bg-destructive/90 sm:h-9"
            >
              {busy && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
              Decline request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  return { accept, decline, respondingId, dialogs }
}
