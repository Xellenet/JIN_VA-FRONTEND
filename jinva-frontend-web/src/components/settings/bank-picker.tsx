"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import type { Bank } from "@/lib/earnings-api"
import { cn } from "@/lib/utils"

/**
 * H11 / B6: pick a Ghanaian bank by name (from `GET /payments/banks`), with
 * search. The code that goes to `POST /payments/payout-method` is never typed
 * by hand. A combobox: the trigger is labelled by the field's label and
 * described by its hint or error, like any other control in `FormField`.
 */
export function BankPicker({
  id,
  banks,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
  status,
  onRetry,
}: Readonly<{
  id: string
  banks: Bank[]
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  status: "loading" | "error" | "ready"
  onRetry: () => void
}>) {
  const [open, setOpen] = useState(false)
  const selected = banks.find((b) => b.code === value)

  if (status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        The bank list didn&apos;t load.
        <Button type="button" variant="outline" size="sm" className="max-sm:h-11" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-haspopup="listbox"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled || status === "loading"}
          className={cn(
            "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs max-sm:h-11 dark:bg-input/30",
            "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {status === "loading" ? "Loading banks…" : (selected?.name ?? "Choose your bank")}
          </span>
          <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent id={`${id}-list`} className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0" align="start">
        <Command
          filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Search banks" aria-label="Search banks" className="h-11" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No bank matches that name.</CommandEmpty>
            <CommandGroup>
              {banks.map((b) => (
                <CommandItem
                  key={b.code}
                  value={`${b.name} ${b.code}`}
                  onSelect={() => {
                    onChange(b.code)
                    setOpen(false)
                  }}
                  className="min-h-11"
                >
                  <Check aria-hidden="true" className={cn("h-4 w-4", value === b.code ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">{b.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
