"use client"

/**
 * FR-4.16 / AC-4.4: the customer has never paid. No charts, history or CSV.
 * "How paying works" reuses the dot-and-line idiom of the Overview job track.
 * Step 2 uses the owner's copy (plan §0.2): the money is "held".
 */
import Link from "next/link"
import type { CSSProperties } from "react"
import { Plus, Search, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FOCUS_RING } from "./shared"

const STEPS = [
  { title: "You pay for a job.", body: "By mobile money, card or bank, through Paystack." },
  { title: "It's held.", body: "Your payment is held until you confirm the job is done." },
  { title: "You confirm, the artisan is paid.", body: "Only after you say the job is done." },
]

export function SpendingEmpty() {
  return (
    <section
      data-enter
      aria-labelledby="spending-empty-title"
      className="rounded-2xl border border-border bg-card px-5 py-8 sm:px-10 sm:py-14"
    >
      <div className="mx-auto max-w-[640px]">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Wallet aria-hidden="true" className="h-5 w-5" />
        </span>
        <h2 id="spending-empty-title" className="mt-6 text-xl font-semibold tracking-tight text-foreground">
          You haven&apos;t made any payments yet.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          When you pay for a job, you&apos;ll see where your money goes here.
        </p>

        <ol
          aria-label="How paying on JinVa works"
          className="mt-8 grid gap-5 rounded-xl bg-muted/60 p-5 sm:grid-cols-3 sm:gap-4"
        >
          {STEPS.map((step, i) => {
            const last = i === STEPS.length - 1
            return (
              <li key={step.title} className="relative flex gap-3 sm:block">
                <div aria-hidden="true" className="flex shrink-0 flex-col items-center sm:flex-row">
                  <span
                    className={cn(
                      "mt-1 h-2.5 w-2.5 shrink-0 rounded-full sm:mt-0",
                      last ? "border border-muted-foreground/60 bg-card" : "bg-primary dark:bg-ring",
                    )}
                  />
                  {!last ? (
                    <span
                      data-draw
                      style={{ "--reveal-delay": `${200 + i * 150}ms` } as CSSProperties}
                      className="mt-1 w-px flex-1 bg-border sm:ml-2 sm:mt-0 sm:h-px sm:w-auto"
                    />
                  ) : null}
                </div>
                <div className="sm:mt-4">
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{step.body}</p>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-8 grid grid-cols-2 gap-2 sm:flex">
          <Button asChild className={cn(FOCUS_RING, "h-11")}>
            <Link href="/dashboard/user/post-job">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Post a job
            </Link>
          </Button>
          <Button asChild variant="outline" className={cn(FOCUS_RING, "h-11 bg-transparent")}>
            <Link href="/dashboard/user/search">
              <Search aria-hidden="true" className="h-4 w-4" />
              Find artisans
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
