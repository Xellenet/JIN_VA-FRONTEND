import { Card } from "@/components/ui/card"
import { CheckCircle2, Circle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * DC3 / design-spec.md §2.4 — where a party's dispute stands, in three steps:
 * **Filed → Under review → Decision**.
 *
 * Three, not four. The previously-approved design had
 * `… → Decision → Closed`, which is wrong against the real state machine:
 * `resolve()` sets a verdict and `RESOLVED`, while `close()` sets `CLOSED` and
 * deliberately leaves `outcome` null. They are alternative terminal states, not
 * a sequence — a four-step strip would promise every dispute gets a decision
 * *and then* closes, which never happens.
 *
 * `OPEN` and `UNDER_REVIEW` render identically on purpose. The difference is
 * real to an admin (has anyone picked this up) and meaningless to a party —
 * either way they are waiting — and the header badge already carries it. A
 * fourth dot for it would imply the party can act on it.
 *
 * Built from primitives already in the app: a track-plus-fill bar and three
 * glyphs, so state is never signalled by colour alone. The track itself is
 * decorative — the labels carry the meaning — so it is `aria-hidden`.
 */
export function DisputeProgressStrip({
  status,
  className,
}: Readonly<{ status: string; className?: string }>) {
  const isTerminal = status === "RESOLVED" || status === "CLOSED"
  const thirdLabel = status === "RESOLVED" ? "Decided" : status === "CLOSED" ? "Closed" : "Decision"

  const steps: { label: string; state: "done" | "current" | "pending" }[] = [
    { label: "Filed", state: "done" },
    { label: "Under review", state: isTerminal ? "done" : "current" },
    { label: thirdLabel, state: isTerminal ? "done" : "pending" },
  ]

  return (
    <Card className={cn("p-5", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: isTerminal ? "100%" : "50%" }}
        />
      </div>
      <ol className="mt-3 flex items-start justify-between gap-2">
        {steps.map(({ label, state }) => {
          const Icon = state === "done" ? CheckCircle2 : state === "current" ? Clock : Circle
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-1 text-center">
              <Icon
                className={cn(
                  "h-4 w-4",
                  state === "pending" ? "text-muted-foreground" : "text-primary",
                )}
              />
              <span
                className={cn(
                  "text-xs",
                  state === "pending"
                    ? "text-muted-foreground"
                    : "font-medium text-foreground",
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
