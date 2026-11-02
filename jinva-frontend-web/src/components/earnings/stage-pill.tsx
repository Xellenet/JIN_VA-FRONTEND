import { AlertTriangle, ArrowDownRight, CheckCircle2, Clock, Lock, Send, XCircle, type LucideIcon } from "lucide-react"
import { stageLabel, type EarningsStage } from "@/lib/earnings"
import { cn } from "@/lib/utils"

/**
 * An earnings row's stage in the artisan's words. Colour plus icon plus text,
 * never colour alone. Normal held money is "Waiting for sign-off", not the
 * customer badge's "Withheld".
 */
const STAGE_STYLE: Record<EarningsStage, { icon: LucideIcon; className: string }> = {
  awaiting_payment: { icon: Clock, className: "bg-warning/10 text-warning border-warning/20" },
  held: { icon: Lock, className: "bg-info/10 text-info border-info/20" },
  on_the_way: { icon: Send, className: "bg-primary/10 text-primary border-primary/20 dark:text-ring dark:border-ring/30" },
  needs_action: { icon: AlertTriangle, className: "bg-attention/10 text-attention border-attention/20" },
  paid: { icon: CheckCircle2, className: "bg-success/10 text-success border-success/20" },
  refunded: { icon: ArrowDownRight, className: "bg-muted text-muted-foreground border-border" },
  not_paid: { icon: XCircle, className: "bg-muted text-muted-foreground border-border" },
}

export function StagePill({ stage, className }: Readonly<{ stage: EarningsStage; className?: string }>) {
  const style = STAGE_STYLE[stage] ?? STAGE_STYLE.not_paid
  const Icon = style.icon
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        style.className,
        className,
      )}
    >
      <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
      {stageLabel(stage)}
    </span>
  )
}
