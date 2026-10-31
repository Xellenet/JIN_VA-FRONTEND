"use client"

/**
 * Phone: the "Filter payments" bottom sheet (spec §3). Changes are a draft
 * until "Show N payments"; N is fetched for the draft. Focus is trapped while
 * open, Escape closes it, and focus returns to the Filters button (NFR-2.9).
 */
import { useEffect, useState } from "react"
import { X } from "lucide-react"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import type { PaymentHistoryFilterOptions } from "@/lib/customer-api"
import {
  STATUS_FILTER_OPTIONS,
  plural,
  selectedStatusOptions,
  toggleStatusOption,
  type HistoryFilters,
} from "@/lib/spending"
import { cn } from "@/lib/utils"
import { FiltersButton, PickFilter, type FilterPatch } from "./history-filters"
import { FOCUS_RING } from "./shared"

type Draft = Pick<HistoryFilters, "status" | "serviceId" | "artisanProfileId">

export function HistoryFilterSheet({
  filters,
  options,
  onApply,
  countFor,
}: Readonly<{
  filters: HistoryFilters
  options: PaymentHistoryFilterOptions | null
  onApply: (patch: FilterPatch) => void
  /** Number of payments the draft would show; rejects on failure. */
  countFor: (draft: Draft, signal: AbortSignal) => Promise<number>
}>) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>({
    status: filters.status,
    serviceId: filters.serviceId,
    artisanProfileId: filters.artisanProfileId,
  })
  const [count, setCount] = useState<number | null>(null)

  // Opening starts from what is applied now.
  useEffect(() => {
    if (open) setDraft({ status: filters.status, serviceId: filters.serviceId, artisanProfileId: filters.artisanProfileId })
  }, [open, filters.status, filters.serviceId, filters.artisanProfileId])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setCount(null)
    const timer = window.setTimeout(() => {
      countFor(draft, controller.signal)
        .then((n) => setCount(n))
        .catch(() => setCount(null))
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, draft, countFor])

  const selected = new Set(selectedStatusOptions(draft.status).map((o) => o.key))

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <FiltersButton filters={filters} />
      </DrawerTrigger>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="flex flex-row items-center justify-between px-5 pb-2 pt-3 text-left">
          <DrawerTitle className="text-lg">Filter payments</DrawerTitle>
          <DrawerDescription className="sr-only">Choose which payments to show in your history.</DrawerDescription>
          <DrawerClose asChild>
            <button type="button" aria-label="Close" className={cn(FOCUS_RING, "-mr-2 grid h-11 w-11 place-items-center rounded-md text-muted-foreground")}>
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </DrawerClose>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <fieldset>
            <legend className="pt-1 text-sm font-medium text-foreground">Status</legend>
            <ul className="mt-1 divide-y divide-border">
              {STATUS_FILTER_OPTIONS.map((o) => {
                const id = `sheet-status-${o.key}`
                return (
                  <li key={o.key}>
                    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
                      <Checkbox
                        id={id}
                        checked={selected.has(o.key)}
                        onCheckedChange={() => setDraft((d) => ({ ...d, status: toggleStatusOption(d.status, o.key) }))}
                        className="size-5"
                      />
                      {o.label}
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>
          <div className="mt-5">
            <label htmlFor="sheet-service" className="text-sm font-medium text-foreground">
              Service
            </label>
            <div className="mt-2">
              <PickFilter
                id="sheet-service"
                kind="service"
                variant="field"
                value={draft.serviceId}
                options={options}
                onChange={(serviceId) => setDraft((d) => ({ ...d, serviceId }))}
              />
            </div>
          </div>
          <div className="mt-5">
            <label htmlFor="sheet-artisan" className="text-sm font-medium text-foreground">
              Artisan
            </label>
            <div className="mt-2">
              <PickFilter
                id="sheet-artisan"
                kind="artisan"
                variant="field"
                value={draft.artisanProfileId}
                options={options}
                onChange={(artisanProfileId) => setDraft((d) => ({ ...d, artisanProfileId }))}
              />
            </div>
          </div>
        </div>
        <DrawerFooter className="grid grid-cols-2 gap-3 border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className={cn(FOCUS_RING, "h-12")}
            onClick={() => setDraft({ status: [], serviceId: null, artisanProfileId: null })}
          >
            Clear all filters
          </Button>
          <Button
            type="button"
            className={cn(FOCUS_RING, "h-12")}
            onClick={() => {
              onApply(draft)
              setOpen(false)
            }}
          >
            {count === null ? "Show payments" : `Show ${plural(count, "payment")}`}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
