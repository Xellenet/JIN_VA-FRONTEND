"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormField } from "@/components/forms/form-field"
import { ApiError, apiFetch } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"

export interface ApplyJobTarget {
  id: string | number
  title: string
  budgetMin?: number | string | null
  budgetMax?: number | string | null
}

const MESSAGE_MAX = 1000

/**
 * QA JOB-08: Apply used to send `quotePrice: 0` with a canned message, so an
 * accepted application created a GH₵ 0 payment Paystack rejects. The artisan
 * now states a price (prefilled with the customer's maximum budget) and can
 * add a short cover note.
 */
export function ApplyJobDialog({
  job,
  open,
  onOpenChange,
  onApplied,
}: {
  job: ApplyJobTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: (jobId: string | number) => void
}) {
  const [quote, setQuote] = useState("")
  const [message, setMessage] = useState("")
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !job) return
    const suggested = Number(job.budgetMax ?? job.budgetMin ?? 0)
    setQuote(suggested > 0 ? String(suggested) : "")
    setMessage("")
    setQuoteError(null)
  }, [open, job])

  const validateQuote = (raw: string): string | null => {
    const value = raw.trim()
    if (value === "") return "Enter your price for this job"
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return "Use a number with up to 2 decimal places, like 150.50"
    if (Number(value) <= 0) return "Enter an amount above 0"
    return null
  }

  const submit = async () => {
    if (!job) return
    const error = validateQuote(quote)
    setQuoteError(error)
    if (error) {
      document.getElementById("apply-quote")?.focus()
      return
    }
    setIsSubmitting(true)
    try {
      await apiFetch(`/jobs/${job.id}/apply`, {
        method: "POST",
        body: JSON.stringify({
          quotePrice: Number(quote),
          ...(message.trim() ? { message: message.trim() } : {}),
        }),
      })
      toast.success("Application sent. The customer will be notified.")
      onApplied(job.id)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.info("You've already applied to this job.")
        onApplied(job.id)
        onOpenChange(false)
        return
      }
      toast.error(err instanceof Error ? err.message : "Couldn't send your application.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const budget =
    job && (job.budgetMin != null || job.budgetMax != null)
      ? [job.budgetMin, job.budgetMax]
          .filter((v) => v != null && Number(v) > 0)
          .map((v) => formatCurrency(Number(v)))
          .join(" – ")
      : ""

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply for this job</DialogTitle>
          <DialogDescription>
            {job?.title}
            {budget ? ` · Customer budget ${budget}` : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <FormField
            id="apply-quote"
            label="Your price (GH₵)"
            hint="What you'll charge for the whole job. The customer sees it when choosing."
            error={quoteError}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={quote}
                onChange={(e) => {
                  setQuote(e.target.value)
                  if (quoteError) setQuoteError(validateQuote(e.target.value))
                }}
                disabled={isSubmitting}
              />
            )}
          </FormField>
          <FormField
            id="apply-message"
            label="Message to the customer"
            optional
            aside={
              <span className="text-xs text-muted-foreground">
                {message.length}/{MESSAGE_MAX}
              </span>
            }
          >
            {(control) => (
              <Textarea
                {...control}
                rows={4}
                maxLength={MESSAGE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
              />
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send application
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
