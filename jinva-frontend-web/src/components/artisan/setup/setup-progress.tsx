import { Search } from "lucide-react"
import { progressLabel, type SetupState } from "@/lib/artisan-setup"
import { cn } from "@/lib/utils"

/**
 * Six segments, one per step, filled as each is done (in any order). A tick
 * after the second marks where client search starts: the backend lists an
 * artisan once their services, rate and area are saved, which are steps 1
 * and 2. The bar is one `progressbar`; the tick is decoration, and the page
 * says the same thing in words.
 */
export function SetupProgress({
  state,
  size = "lg",
  className,
}: Readonly<{ state: Pick<SetupState, "steps" | "doneCount" | "total">; size?: "lg" | "sm"; className?: string }>) {
  return (
    <div className={cn("relative", size === "lg" ? "pb-6" : "pb-0", className)}>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={state.total}
        aria-valuenow={state.doneCount}
        aria-valuetext={progressLabel(state)}
        className="flex gap-1"
      >
        {state.steps.map((step, i) => (
          <span
            key={step.key}
            className={cn(
              "flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
              size === "lg" ? "h-2" : "h-1.5",
              step.done ? "bg-primary dark:bg-success" : "bg-muted-foreground/20",
              // The search threshold: a wider gap after step 2.
              i === 1 && "mr-2",
            )}
          />
        ))}
      </div>
      {size === "lg" && (
        <span
          aria-hidden="true"
          className="absolute top-3.5 flex -translate-x-1/2 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground"
          // Under the wider gap: two of six segments plus the gaps before it.
          style={{ left: "calc((100% - 1.75rem) / 3 + 0.625rem)" }}
        >
          <Search className="h-3 w-3" />
          In search
        </span>
      )}
    </div>
  )
}
