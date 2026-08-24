import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * The admin area's four-up "queue counter" tile — design-spec.md §2.3.
 *
 * This exact markup (tinted `CardContent`, `text-xs` muted label, `text-2xl`
 * value, no icon) was hand-rolled identically on three screens: the disputes
 * queue, the portfolio moderation queue and the reviews moderation queue.
 * Named and extracted here rather than folded into `StatsCard`, because it is
 * a deliberately different idiom: a queue counter answers "how much work is
 * in each bucket", a `StatsCard` answers "how is this metric doing". Keeping
 * both — named — is the honest outcome; a fourth pattern is not added.
 *
 * `sublabel` exists for the honesty captions these tiles already need
 * ("(session)" on the portfolio queue, "N over 48h" on the disputes queue) so
 * a caveat never has to become a fifth tile.
 */
export interface QueueCounterCardProps {
  label: string
  value: number | string
  /** Value tint. Defaults to the neutral `foreground`. */
  tone?: "foreground" | "muted" | "primary" | "destructive"
  /** Optional second line under the value (e.g. "3 over 48h", "(session)"). */
  sublabel?: ReactNode
  /** Renders a `Skeleton` in place of the value while the count is loading. */
  isLoading?: boolean
  className?: string
}

const VALUE_TONE: Record<NonNullable<QueueCounterCardProps["tone"]>, string> = {
  foreground: "text-foreground",
  muted: "text-muted-foreground",
  primary: "text-primary",
  destructive: "text-destructive",
}

const BG_TONE: Record<NonNullable<QueueCounterCardProps["tone"]>, string> = {
  foreground: "bg-muted",
  muted: "bg-muted",
  primary: "bg-primary/10",
  destructive: "bg-destructive/10",
}

export function QueueCounterCard({
  label,
  value,
  tone = "foreground",
  sublabel,
  isLoading = false,
  className,
}: Readonly<QueueCounterCardProps>) {
  return (
    <Card className={className}>
      <CardContent className={cn("p-4", BG_TONE[tone])}>
        <p className="text-xs text-muted-foreground">{label}</p>
        {isLoading ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <p className={cn("mt-0.5 text-2xl font-bold", VALUE_TONE[tone])}>{value}</p>
        )}
        {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  )
}
