"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneNational,
  getPhoneCountryOptions,
  isSupportedPhoneCountry,
  readInternationalInput,
  type PhoneCountryOption,
  type SupportedPhoneCountry,
} from "@/lib/phone"

/**
 * PH1–PH5 (google-signup-prefill, design-spec §3.3): country picker + national
 * number input.
 *
 * - The country is an **ISO alpha-2 code** (`"GH"`), never a calling code,
 *   because `+44` alone can't tell GB from GG. Anything unknown falls back to
 *   Ghana, never to the first list entry.
 * - The list is `SUPPORTED_PHONE_COUNTRIES`: Ghana pinned first, the rest by
 *   name. Codes come from `getCountryCallingCode()`, names from
 *   `Intl.DisplayNames`.
 * - Typing, pasting or autofilling `+CC…` / `00CC…` switches the picker and
 *   leaves only the national part in the field (PH3), so `+233 +233…` can't
 *   happen. An unsupported code leaves the picker alone; the form's validator
 *   shows the "can't take" message.
 * - No reformatting while typing; a valid number is shown in national format
 *   on blur (PH5). No `maxLength` and no placeholder.
 *
 * Every other prop (`id`, `aria-*`, `required`, `onBlur`, …) goes to the
 * number input, which is what `<Label htmlFor>` and focus-first-error target.
 * Submit with `phoneToE164(value, country)` from `@/lib/phone`.
 */
export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "placeholder" | "ref"> {
  value: string
  onChange: (value: string) => void
  country: SupportedPhoneCountry
  onCountryChange: (country: SupportedPhoneCountry) => void
  /** Polite announcements ("Country set to Nigeria +234.") for the form's live region. */
  onAnnounce?: (message: string) => void
  /** Classes for the wrapper row. */
  className?: string
  inputClassName?: string
}

let cachedOptions: ReturnType<typeof getPhoneCountryOptions> | null = null
const countryOptions = () => (cachedOptions ??= getPhoneCountryOptions())

/** cmdk filters on this text: "nig", "234" and "+234" all match Nigeria. */
function itemValue(option: PhoneCountryOption): string {
  return `${option.name} +${option.callingCode} ${option.country}`
}

function findOption(country: string): PhoneCountryOption {
  const { pinned, others } = countryOptions()
  return [pinned, ...others].find((o) => o.country === country) ?? pinned
}

export function PhoneInput({
  value,
  onChange,
  country,
  onCountryChange,
  onAnnounce,
  disabled,
  className,
  inputClassName,
  onBlur,
  autoComplete = "tel-national",
  enterKeyHint = "next",
  inputMode = "tel",
  ...inputProps
}: Readonly<PhoneInputProps>) {
  const [open, setOpen] = React.useState(false)
  // The highlighted row (cmdk's value). Set to the current country on open, so
  // the highlight starts on the checked row and Enter keeps the current
  // country instead of switching to the first row (Ghana).
  const [highlighted, setHighlighted] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const focusNumberOnClose = React.useRef(false)
  const selected = findOption(isSupportedPhoneCountry(country) ? country : DEFAULT_PHONE_COUNTRY)
  const { pinned, others } = countryOptions()

  const switchCountry = (next: SupportedPhoneCountry) => {
    if (next === selected.country) return
    onCountryChange(next)
    const option = findOption(next)
    onAnnounce?.(`Country set to ${option.name} +${option.callingCode}.`)
  }

  const handleChange = (raw: string) => {
    const international = readInternationalInput(raw)
    if (international.kind === "supported") {
      switchCountry(international.country)
      onChange(international.national)
      return
    }
    onChange(raw)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNational(value, selected.country)
    if (formatted && formatted !== value) onChange(formatted)
    onBlur?.(e)
  }

  const handleOpenChange = (next: boolean) => {
    if (next) setHighlighted(itemValue(selected))
    setOpen(next)
  }

  const renderItem = (option: PhoneCountryOption) => (
    <CommandItem
      key={option.country}
      value={itemValue(option)}
      onSelect={() => {
        switchCountry(option.country)
        focusNumberOnClose.current = true
        setOpen(false)
      }}
      className="cursor-pointer"
    >
      <Check
        className={cn("h-4 w-4", option.country === selected.country ? "opacity-100" : "opacity-0")}
        aria-hidden="true"
      />
      <span aria-hidden="true">{option.flag}</span>
      <span className="flex-1">{option.name}</span>
      <span className="text-muted-foreground">+{option.callingCode}</span>
    </CommandItem>
  )

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label={`Country code: ${selected.name} +${selected.callingCode}`}
            disabled={disabled}
            className="h-10 w-[120px] shrink-0 justify-between bg-background border-input text-foreground shadow-none"
          >
            <span className="flex items-center gap-2" aria-hidden="true">
              <span>{selected.flag}</span>
              <span className="text-sm">+{selected.callingCode}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[280px] p-0 shadow-md border-input"
          onCloseAutoFocus={(e) => {
            // Choosing a country moves focus to the number (§3.3); Esc returns it to the button.
            if (focusNumberOnClose.current) {
              focusNumberOnClose.current = false
              e.preventDefault()
              inputRef.current?.focus()
            }
          }}
        >
          <Command value={highlighted} onValueChange={setHighlighted}>
            <CommandInput aria-label="Search countries" />
            <CommandList>
              <CommandEmpty>No country found. Check the spelling.</CommandEmpty>
              <CommandGroup>{renderItem(pinned)}</CommandGroup>
              <CommandSeparator />
              <CommandGroup>{others.map(renderItem)}</CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        {...inputProps}
        ref={inputRef}
        type="tel"
        inputMode={inputMode}
        autoComplete={autoComplete}
        enterKeyHint={enterKeyHint}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        className={cn("h-10 flex-1 bg-background border-input text-foreground shadow-none", inputClassName)}
      />
    </div>
  )
}
