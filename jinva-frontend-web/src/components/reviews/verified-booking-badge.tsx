import { Badge } from "@/components/ui/badge"
import { BadgeCheck } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * design-spec.md §5.1 — every review is inherently booking-verified
 * (job exists, COMPLETED, had an accepted artisan, per api-contract.md §3's
 * `verifiedBooking` flag). Label is always exactly "Verified Booking" per
 * the copy guidelines (§9) — never "Verified Purchase"/"Confirmed Job".
 */
export function VerifiedBookingBadge({ className }: Readonly<{ className?: string }>) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-primary/20 bg-primary/5 text-primary", className)}
    >
      <BadgeCheck className="h-3 w-3" />
      Verified Booking
    </Badge>
  )
}
