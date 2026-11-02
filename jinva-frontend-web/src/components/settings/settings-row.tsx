import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Shared building blocks for the Settings pages of both roles (client
 * Payments, artisan Payouts), so the two read as one product.
 */

export const SETTINGS_FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-ring"

/** One "label column | controls" row; stacks when the card is narrow. Wrap rows in a `@container` card. */
export function SettingsRow({
  title,
  description,
  children,
  first = false,
  titleId,
}: Readonly<{ title: string; description: ReactNode; children: ReactNode; first?: boolean; titleId?: string }>) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "grid gap-4 p-4 sm:p-6 @[56rem]:grid-cols-[minmax(0,260px)_minmax(0,1fr)] @[56rem]:gap-10 @[56rem]:px-8 @[56rem]:py-7",
        !first && "border-t",
      )}
    >
      <div>
        <h3 id={titleId} className="text-[15px] font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="@container/controls min-w-0">{children}</div>
    </section>
  )
}

/** The radio dot used inside Radix radio-group tiles (`group` on the item). */
export function RadioMark() {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-[18px] w-[18px] shrink-0 rounded-full border border-foreground/30 bg-background transition-[border-width,border-color] motion-reduce:transition-none",
        "group-data-[state=checked]:border-[5px] group-data-[state=checked]:border-primary",
      )}
    />
  )
}

/** Classes for a selectable tile (a Radix `RadioGroup.Item`). */
export const RADIO_TILE_CLASS = cn(
  "group flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-left",
  "transition-colors motion-reduce:transition-none hover:border-foreground/25",
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary/[0.04] data-[state=checked]:ring-1 data-[state=checked]:ring-primary",
  "disabled:cursor-not-allowed",
  SETTINGS_FOCUS_RING,
)

/**
 * Ghana's mobile money networks, with the monogram tiles the client Payments
 * tab uses (Q-P2: placeholders until the real logos are licensed). These are
 * brand marks, so the colours are fixed in both themes.
 *
 * `payoutCode` is the code Paystack transfers take (`POST
 * /payments/payout-method` `bankCode`) — Telecel kept Vodafone's `VOD`.
 */
export const MOMO_NETWORKS = [
  {
    value: "MTN",
    payoutCode: "MTN",
    label: "MTN MoMo",
    mark: "MTN",
    tile: "bg-[oklch(0.86_0.176_92)] text-[oklch(0.2_0_0)]",
  },
  {
    value: "TELECEL",
    payoutCode: "VOD",
    label: "Telecel Cash",
    mark: "T",
    tile: "bg-[oklch(0.57_0.233_28)] text-white",
  },
  {
    value: "AT",
    payoutCode: "ATL",
    label: "AirtelTigo Money",
    mark: "AT",
    tile: "bg-[oklch(0.37_0.15_262)] text-white",
  },
] as const

export type MomoNetworkOption = (typeof MOMO_NETWORKS)[number]

/** The network tile itself (decorative; the label carries the name). */
export function NetworkMark({ network, className }: Readonly<{ network: MomoNetworkOption; className?: string }>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-tight",
        network.tile,
        className,
      )}
    >
      {network.mark}
    </span>
  )
}
