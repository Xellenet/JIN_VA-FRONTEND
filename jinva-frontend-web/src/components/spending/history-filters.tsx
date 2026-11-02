"use client"

/**
 * FR-4.12: the history filters. Status is a multi-select; Service and Artisan
 * list only what the customer has paid (B3f); search is debounced by the page
 * and capped at 100 characters. An active control writes its value and shows
 * a ✓, so the state is never colour alone (NFR-2.3). Below 768px the three
 * selects move into the "Filter payments" sheet.
 */
import { forwardRef, type ComponentProps } from "react"
import { Check, ChevronDown, Search, SlidersHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import type { PaymentHistoryFilterOptions } from "@/lib/customer-api"
import {
  SEARCH_MAX,
  STATUS_FILTER_OPTIONS,
  activeFilterCount,
  selectedStatusOptions,
  statusTriggerValue,
  toggleStatusOption,
  type HistoryFilters,
} from "@/lib/spending"
import { cn } from "@/lib/utils"
import { FOCUS_RING } from "./shared"

export type FilterPatch = Partial<Omit<HistoryFilters, "page" | "search">>

const ALL = "all"

/** Label for a chosen service / artisan id, from the options list. */
export function optionName(
  options: PaymentHistoryFilterOptions | null,
  kind: "service" | "artisan",
  id: number | null,
): string | null {
  if (id === null) return null
  if (kind === "service") return options?.services.find((s) => s.id === id)?.name ?? "Selected"
  return options?.artisans.find((a) => a.id === id)?.displayName ?? "Selected"
}

const triggerClass = (active: boolean) =>
  cn(
    FOCUS_RING,
    "inline-flex h-10 max-w-full items-center gap-2 rounded-lg border px-3 text-sm",
    active
      ? "border-primary/40 bg-primary/[0.06] font-medium text-foreground dark:border-ring/50 dark:bg-ring/10"
      : "border-border bg-card text-muted-foreground hover:text-foreground",
  )

const TriggerBody = ({ label, value }: Readonly<{ label: string; value: string | null }>) => (
  <>
    {value ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary dark:text-ring" /> : null}
    <span className="min-w-0 truncate">
      {value ? (
        <>
          {label}: <span dir="auto" className="[unicode-bidi:isolate]">{value}</span>
        </>
      ) : (
        label
      )}
    </span>
    <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
  </>
)

export function SearchBox({
  value,
  onChange,
  className,
}: Readonly<{ value: string; onChange: (value: string) => void; className?: string }>) {
  return (
    <label className={cn("relative flex items-center", className)}>
      <span className="sr-only">Search payments</span>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
      <input
        type="search"
        value={value}
        maxLength={SEARCH_MAX}
        onChange={(e) => onChange(e.target.value.slice(0, SEARCH_MAX))}
        placeholder="Search job title or reference"
        autoComplete="off"
        className={cn(
          FOCUS_RING,
          "h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground md:h-10",
        )}
      />
    </label>
  )
}

export function StatusFilter({
  status,
  onChange,
}: Readonly<{ status: HistoryFilters["status"]; onChange: (patch: FilterPatch) => void }>) {
  const selected = new Set(selectedStatusOptions(status).map((o) => o.key))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClass(selected.size > 0)}>
        <TriggerBody label="Status" value={statusTriggerValue(status)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {STATUS_FILTER_OPTIONS.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.key}
            checked={selected.has(o.key)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => onChange({ status: toggleStatusOption(status, o.key) })}
            className="py-2"
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PickFilter({
  kind,
  value,
  options,
  onChange,
  variant = "trigger",
  id,
}: Readonly<{
  kind: "service" | "artisan"
  value: number | null
  options: PaymentHistoryFilterOptions | null
  onChange: (id: number | null) => void
  variant?: "trigger" | "field"
  id?: string
}>) {
  const label = kind === "service" ? "Service" : "Artisan"
  const allLabel = kind === "service" ? "All services" : "All artisans"
  const items =
    kind === "service"
      ? (options?.services ?? []).map((s) => ({ id: s.id, name: s.name }))
      : (options?.artisans ?? []).map((a) => ({ id: a.id, name: a.displayName }))
  const name = optionName(options, kind, value)
  return (
    <Select value={value === null ? ALL : String(value)} onValueChange={(v) => onChange(v === ALL ? null : Number(v))}>
      {variant === "trigger" ? (
        <SelectTrigger aria-label={name ? `${label}: ${name}` : label} className={cn(triggerClass(value !== null), "h-10 shadow-none [&>svg:last-child]:hidden")}>
          <TriggerBody label={label} value={name} />
        </SelectTrigger>
      ) : (
        <SelectTrigger id={id} className={cn(FOCUS_RING, "h-12 w-full rounded-lg bg-card px-4 text-base")}>
          <span className={cn("min-w-0 truncate", !name && "text-muted-foreground")} dir="auto">
            {name ?? allLabel}
          </span>
        </SelectTrigger>
      )}
      <SelectContent className="max-h-72">
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {items.map((it) => (
          <SelectItem key={it.id} value={String(it.id)}>
            <span dir="auto" className="[unicode-bidi:isolate]">
              {it.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Phone: the button that opens the sheet, with a count badge. */
export const FiltersButton = forwardRef<HTMLButtonElement, ComponentProps<"button"> & { filters: HistoryFilters }>(
  function FiltersButton({ filters, className, ...props }, ref) {
    const count = activeFilterCount(filters)
    return (
      <button
        ref={ref}
        type="button"
        aria-label={count ? `Filters, ${count} applied` : "Filters"}
        className={cn(
          FOCUS_RING,
          "inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium",
          count ? "border-primary/40 bg-primary/[0.06] dark:border-ring/50 dark:bg-ring/10" : "border-border bg-card",
          className,
        )}
        {...props}
      >
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
        Filters
        {count ? (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
            {count}
          </span>
        ) : null}
      </button>
    )
  },
)

/** "Plumbing, Paid Out": the phone's written list of active filter values. */
export function activeValuesText(filters: HistoryFilters, options: PaymentHistoryFilterOptions | null): string {
  return [
    optionName(options, "service", filters.serviceId),
    optionName(options, "artisan", filters.artisanProfileId),
    ...selectedStatusOptions(filters.status).map((o) => o.label),
  ]
    .filter(Boolean)
    .join(", ")
}
