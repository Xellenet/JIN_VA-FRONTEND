"use client"

import type React from "react"
import { PhoneInput } from "@/components/ui/phone-input"
import { FormField } from "@/components/forms/form-field"
import { PHONE_MESSAGES, type SupportedPhoneCountry } from "@/lib/phone"

/**
 * The phone row used by `/signup` and "Complete your account" (and, PH11, the
 * settings pages): label, `PhoneInput`, the per-country helper and the V error
 * slot. Validate with `validatePhoneNumber(value, country, …)` and submit
 * `phoneToE164(value, country)`, both from `@/lib/phone`.
 */
export interface PhoneFieldProps {
  id?: string
  label?: React.ReactNode
  value: string
  country: SupportedPhoneCountry
  onChange: (value: string) => void
  onCountryChange: (country: SupportedPhoneCountry) => void
  onBlur?: () => void
  onAnnounce?: (message: string) => void
  error?: React.ReactNode
  /** Defaults to the PH5 helper for the selected country. Pass `null` for none. */
  hint?: React.ReactNode | null
  disabled?: boolean
  required?: boolean
  className?: string
}

export function PhoneField({
  id = "phoneNumber",
  label = "Phone number",
  value,
  country,
  onChange,
  onCountryChange,
  onBlur,
  onAnnounce,
  error,
  hint,
  disabled,
  required = true,
  className,
}: Readonly<PhoneFieldProps>) {
  return (
    <FormField
      id={id}
      label={label}
      optional={!required}
      hint={hint === undefined ? PHONE_MESSAGES.hint(country) : (hint ?? undefined)}
      error={error}
      className={className}
    >
      {(control) => (
        <PhoneInput
          {...control}
          name={id}
          value={value}
          onChange={onChange}
          country={country}
          onCountryChange={onCountryChange}
          onAnnounce={onAnnounce}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
        />
      )}
    </FormField>
  )
}
