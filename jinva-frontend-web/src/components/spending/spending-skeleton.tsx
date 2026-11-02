import { ChartsSkeleton } from "./spending-charts"
import { HistorySkeleton } from "./payment-history"
import { Shimmer } from "./shared"
import { StatementBandSkeleton } from "./statement-band"

/** FR-4.15: the whole page in its final shape, before anything has loaded. */
export function SpendingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 sm:space-y-6 min-[1920px]:max-w-[1440px]">
      <p className="sr-only" role="status">
        Loading your spending
      </p>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Shimmer className="h-8 w-48" />
          <Shimmer className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <Shimmer className="h-11 w-full md:h-11 md:w-[340px]" />
      </div>
      <StatementBandSkeleton />
      <ChartsSkeleton />
      <div className="mx-auto w-full max-w-[1200px] rounded-xl border border-border bg-card">
        <div className="px-4 pb-4 pt-5 sm:px-6">
          <Shimmer className="h-4 w-36" />
          <Shimmer className="mt-2 h-3.5 w-64 max-w-full" />
          <Shimmer className="mt-5 h-10 w-full md:w-[300px]" />
        </div>
        <HistorySkeleton />
      </div>
    </div>
  )
}
