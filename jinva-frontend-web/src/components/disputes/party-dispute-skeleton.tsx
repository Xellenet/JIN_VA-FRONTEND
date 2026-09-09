import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * DC3.7 — a skeleton in the page's real shape, not a full-page spinner.
 *
 * Shared by both roles' route-level `loading.tsx` and by the component's own
 * fetch state, so the route transition and the fetch look like one wait rather
 * than two. The route-level mounts need their own padding (`loading.tsx`
 * renders outside `DashboardLayout`, which is a component here rather than a
 * `layout.tsx`); the in-page mount is already inside it.
 */
export function PartyDisputeSkeleton({ className }: Readonly<{ className?: string }>) {
  return (
    <div className={cn("space-y-6", className)}>
      <Skeleton className="h-9 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
