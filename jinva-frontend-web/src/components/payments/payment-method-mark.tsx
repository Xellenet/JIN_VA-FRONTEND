import { CreditCard } from "lucide-react"
import { MOMO_NETWORKS, NetworkMark } from "@/components/settings/settings-row"
import type { SavedPaymentMethod } from "@/lib/saved-payment-methods"
import { cn } from "@/lib/utils"

/** The network tile for a saved wallet, or a card icon. Decorative: the text beside it carries the name. */
export function PaymentMethodMark({ method, className }: Readonly<{ method: SavedPaymentMethod; className?: string }>) {
  if (method.type === "mobile_money" && method.mobileMoney) {
    const network = MOMO_NETWORKS.find((n) => n.payoutCode === method.mobileMoney?.network)
    if (network) return <NetworkMark network={network} className={className} />
  }
  return (
    <span
      aria-hidden="true"
      className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground", className)}
    >
      <CreditCard className="h-[18px] w-[18px]" />
    </span>
  )
}
