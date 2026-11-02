/**
 * The artisan has never been paid for a job. Same idiom as the customer's
 * Spending empty state: what happens, in three steps, and where to start.
 * No arrival times: the third step says when we *start* the payout.
 */
import Link from "next/link"
import { Briefcase, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PAYOUT_SETTINGS_HREF } from "@/lib/earnings"
import { cn } from "@/lib/utils"
import { FOCUS_RING } from "@/components/spending/shared"

const STEPS = [
  { title: "The client pays through JinVa.", body: "We keep the money for the job while you do the work." },
  { title: "You finish and mark the job done.", body: "The client is asked to confirm it." },
  {
    title: "We start your payout.",
    body: "When the client confirms, or 48 hours after you mark it done if they don't respond.",
  },
]

export function EarningsEmpty() {
  return (
    <section data-enter aria-labelledby="earnings-empty-title" className="rounded-2xl border border-border bg-card px-5 py-8 sm:px-10 sm:py-14">
      <div className="mx-auto max-w-[640px]">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Wallet aria-hidden="true" className="h-5 w-5" />
        </span>
        <h2 id="earnings-empty-title" className="mt-6 text-xl font-semibold tracking-tight text-foreground">
          No earnings yet
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          When a client pays for one of your jobs, you&apos;ll see the amount, JinVa&apos;s fee and your payout here.
        </p>

        <ol aria-label="How getting paid works" className="mt-8 grid gap-5 rounded-xl bg-muted/60 p-5 sm:grid-cols-3 sm:gap-4">
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
                  {!last ? <span className="mt-1 w-px flex-1 bg-border sm:ml-2 sm:mt-0 sm:h-px sm:w-auto" /> : null}
                </div>
                <div className="sm:mt-4">
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{step.body}</p>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-8 grid gap-2 sm:flex">
          <Button asChild className={cn(FOCUS_RING, "h-11")}>
            <Link href="/dashboard/artisan/jobs">
              <Briefcase aria-hidden="true" className="h-4 w-4" />
              Find jobs
            </Link>
          </Button>
          <Button asChild variant="outline" className={cn(FOCUS_RING, "h-11 bg-transparent")}>
            <Link href={PAYOUT_SETTINGS_HREF}>Check your payout details</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
