"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

/**
 * Shared reason-capture dialog behind every moderation action in this
 * feature — design-spec.md §8 explicitly calls for one component reused
 * across admin Flag, admin Remove, and the customer-facing Report action
 * (§5.3), not three bolted-on dialogs with their own visual language.
 *
 * Deliberately a plain controlled `Dialog`, not `AlertDialog` — matches the
 * existing Payments refund dialog precedent (admin/transactions/page.tsx)
 * for an irreversible action that also needs inline validation + an async
 * in-flight state, which fights Radix's AlertDialogAction auto-close.
 */
export interface ReviewReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  reasonLabel: string
  reasonPlaceholder?: string
  minLength: number
  maxLength: number
  confirmLabel: string
  helperText?: string
  /** Extra, more severe inline warning (e.g. AM3's "permanently deleted" copy). */
  warning?: string
  destructive?: boolean
  onConfirm: (reason: string) => Promise<void>
}

export function ReviewReasonDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  reasonLabel,
  reasonPlaceholder,
  minLength,
  maxLength,
  confirmLabel,
  helperText,
  warning,
  destructive = true,
  onConfirm,
}: Readonly<ReviewReasonDialogProps>) {
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setReason("")
      setIsSubmitting(false)
    }
  }, [open])

  const trimmedLength = reason.trim().length
  const isValid = trimmedLength >= minLength && trimmedLength <= maxLength

  const handleConfirm = async () => {
    if (!isValid || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onConfirm(reason.trim())
      onOpenChange(false)
    } catch (err) {
      // Keep the dialog open (and what was typed) on failure — the admin or
      // customer shouldn't have to retype their reason after a network blip.
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="review-reason">{reasonLabel}</Label>
          <Textarea
            id="review-reason"
            rows={4}
            placeholder={reasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={maxLength}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            {trimmedLength}/{maxLength} characters — minimum {minLength}
          </p>
          {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
          {warning && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="bg-transparent" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90")}
            disabled={!isValid || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
