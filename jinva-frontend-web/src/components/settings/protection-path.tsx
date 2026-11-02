import Link from "next/link"
import { Lock, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Copy per 04 §0.2: "Held" wording only, and no refund timing. The "can't withdraw"
 * line is dropped until legal checks it (Q-P3).
 */
const STEPS = [
  { title: "You pay", body: "By card or mobile money, on Paystack’s secure checkout." },
  { title: "Held", body: "Held until you confirm the job is done. The artisan can see that the job is paid." },
  { title: "The artisan is paid", body: "Only after you confirm the job is done." },
] as const

const REFUNDED = {
  title: "Refunded",
  body: "If a dispute is decided in your favour, the money goes back to how you paid.",
}

function Dot({ hollow = false }: Readonly<{ hollow?: boolean }>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-10 block h-3 w-3 shrink-0 rounded-full ring-[5px] ring-brand",
        hollow ? "border border-brand-foreground/60 bg-brand" : "bg-brand-foreground",
      )}
    />
  )
}

/**
 * "Where your money goes" (Settings & inbox spec §2.2): the payment path drawn
 * like the Overview's job track. It lays out horizontally when its own column
 * is wide enough (container query) and vertically otherwise, with Refunded
 * set apart behind a dashed divider either way. Read-only; needs no data.
 */
export function ProtectionPath() {
  return (
    <div className="@container">
      <div className="overflow-hidden rounded-2xl bg-brand p-5 text-brand-foreground @[34rem]:p-7">
        <p className="text-[17px] font-semibold tracking-tight">Where your money goes</p>
        <p className="mt-1 text-sm text-brand-foreground/75">Your payment is held until you confirm the job is done.</p>

        <div className="mt-6 flex flex-col gap-6 @[34rem]:flex-row @[34rem]:items-stretch">
          <ol className="relative grid flex-1 gap-6 @[34rem]:grid-cols-3">
            {/* Wide: one line across the three dots. */}
            <span
              aria-hidden="true"
              className="absolute left-[6px] right-[calc(33.333%-6px)] top-[5.5px] hidden h-px bg-brand-foreground/35 @[34rem]:block"
            />
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex min-w-0 gap-4 @[34rem]:block">
                {/* Narrow: a segment from this dot down to the next one. */}
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-6 left-[5.5px] top-[15px] w-px bg-brand-foreground/35 @[34rem]:hidden"
                  />
                )}
                <span className="mt-[3px] @[34rem]:mt-0">
                  <Dot />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold @[34rem]:mt-4">
                    <span className="sr-only">{`Step ${i + 1}: `}</span>
                    {step.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-brand-foreground/75">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div
            className={cn(
              "flex gap-4 border-t border-dashed border-brand-foreground/30 pt-6",
              "@[34rem]:block @[34rem]:w-[200px] @[34rem]:shrink-0 @[34rem]:border-l @[34rem]:border-t-0 @[34rem]:pl-6 @[34rem]:pt-0",
            )}
          >
            <span className="mt-[3px] @[34rem]:mt-0">
              <Dot hollow />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold @[34rem]:mt-4">{REFUNDED.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-brand-foreground/75">{REFUNDED.body}</p>
            </div>
          </div>
        </div>
      </div>

      <ul className="mt-5 grid gap-3 @[34rem]:grid-cols-2">
        <li className="flex gap-3 text-[13px] leading-relaxed text-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Card details are typed on Paystack’s page. They never reach JinVa, and JinVa never stores them.</span>
        </li>
        <li className="flex gap-3 text-[13px] leading-relaxed text-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Every payment is processed by Paystack. JinVa keeps a record of what you paid and which method you used.
          </span>
        </li>
      </ul>
      <p className="mt-4 text-[13px] text-muted-foreground">
        A problem with a payment?{" "}
        <Link
          href="/dashboard/user/support"
          className="inline-flex min-h-11 items-center font-medium text-foreground underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0 dark:focus-visible:ring-ring"
        >
          Contact support
        </Link>
      </p>
    </div>
  )
}
