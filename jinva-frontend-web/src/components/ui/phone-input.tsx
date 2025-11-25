"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const countries = [
  { code: "+229", country: "BJ", flag: "🇧🇯", name: "Benin" },
  { code: "+226", country: "BF", flag: "🇧🇫", name: "Burkina Faso" },
  { code: "+238", country: "CV", flag: "🇨🇻", name: "Cape Verde" },
  { code: "+225", country: "CI", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "+220", country: "GM", flag: "🇬🇲", name: "Gambia" },
  { code: "+233", country: "GH", flag: "🇬🇭", name: "Ghana" },
  { code: "+224", country: "GN", flag: "🇬🇳", name: "Guinea" },
  { code: "+245", country: "GW", flag: "🇬🇼", name: "Guinea-Bissau" },
  { code: "+231", country: "LR", flag: "🇱🇷", name: "Liberia" },
  { code: "+223", country: "ML", flag: "🇲🇱", name: "Mali" },
  { code: "+222", country: "MR", flag: "🇲🇷", name: "Mauritania" },
  { code: "+227", country: "NE", flag: "🇳🇪", name: "Niger" },
  { code: "+234", country: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "+221", country: "SN", flag: "🇸🇳", name: "Senegal" },
  { code: "+232", country: "SL", flag: "🇸🇱", name: "Sierra Leone" },
  { code: "+228", country: "TG", flag: "🇹🇬", name: "Togo" },
]

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  countryCode: string
  onCountryCodeChange: (code: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function PhoneInput({
  value,
  onChange,
  countryCode,
  onCountryCodeChange,
  disabled,
  placeholder = "Phone number",
  className,
}: Readonly<PhoneInputProps>) {
  const [open, setOpen] = React.useState(false)
  const selectedCountry = countries.find((c) => c.code === countryCode) || countries[0]

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-10 w-[120px] justify-between bg-white border-gray-200 text-gray-900 shadow-none"
          >
            <span className="flex items-center gap-2">
              <span>{selectedCountry.flag}</span>
              <span className="text-sm">{selectedCountry.code}</span>
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0 shadow-none border-gray-200">
          <Command>
            <CommandInput placeholder="Search country..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {countries.map((country) => (
                  <CommandItem
                    key={`${country.code}-${country.country}`}
                    value={`${country.name} ${country.code}`}
                    onSelect={() => {
                      onCountryCodeChange(country.code)
                      setOpen(false)
                    }}
                    className="hover:bg-green-100  cursor-pointer"
                  >
                    <Check className={cn("mr-2 h-4 w-4", countryCode === country.code ? "opacity-100" : "opacity-0")} />
                    <span className="mr-2">{country.flag}</span>
                    <span className="flex-1">{country.name}</span>
                    <span className="text-muted-foreground">{country.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        type="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-10 flex-1 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 shadow-none"
      />
    </div>
  )
}
