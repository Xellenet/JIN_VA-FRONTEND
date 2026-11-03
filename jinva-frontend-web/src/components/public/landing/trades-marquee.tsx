import Image from "next/image"
import { LoopGate } from "./loop-gate"
import { TRADES } from "./landing-content"

function TradeList({ hidden = false }: { readonly hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="m-0 flex shrink-0 list-none gap-3.5 p-0 pr-3.5">
      {TRADES.map((trade) => (
        <li
          key={trade.name}
          className="flex items-center gap-3 rounded-full border border-border bg-muted/50 py-1.5 pr-4.5 pl-1.5 whitespace-nowrap"
        >
          <Image
            src={trade.photo}
            alt=""
            width={84}
            height={84}
            sizes="42px"
            className="size-10.5 rounded-full object-cover"
          />
          <span className="font-display text-[1.0625rem] font-semibold">{trade.name}</span>
          <span className="text-sm text-muted-foreground">{trade.detail}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Trades strip: the services scroll past with a photo each.
 *
 * The list is rendered twice (the second copy `aria-hidden`) so the track can
 * loop by translating -50%. It pauses on hover and on keyboard focus (the
 * region is focusable for that reason), off-screen, in a hidden tab, and is
 * simply a still row under reduced motion (landing.css).
 */
export function TradesMarquee() {
  return (
    <LoopGate
      as="section"
      id="services"
      aria-label="Trades on JinVa"
      className="scroll-mt-16 border-b border-border bg-background py-5.5"
    >
      <div
        tabIndex={0}
        aria-label="Trades on JinVa, scrolling. Focus or hover to pause."
        role="group"
        className="lp-marquee overflow-hidden outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-inset"
      >
        <div className="lp-marquee-track flex w-max">
          <TradeList />
          <TradeList hidden />
        </div>
      </div>
    </LoopGate>
  )
}
