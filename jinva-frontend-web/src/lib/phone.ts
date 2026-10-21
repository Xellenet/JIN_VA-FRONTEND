import {
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max"
import examples from "libphonenumber-js/mobile/examples"

/**
 * PH1–PH5 (google-signup-prefill): country-aware phone numbers.
 *
 * Built on `libphonenumber-js/max`, pinned to **exactly the same version as the
 * backend** (1.13.15, PH8) so the form and the API can never disagree about a
 * number. `max` metadata is required: with `min`, `isValid()` only checks the
 * length and a wrong prefix (Ghana's unassigned `025…`) would pass.
 *
 * This file deliberately has no `@/` imports: `scripts/test-phone-number.mjs`
 * imports it straight through Node's type stripping and runs the fixture table
 * shared with the backend (`phone-number.fixtures.ts`).
 */

/**
 * The countries whose numbers JinVa accepts (ISO 3166-1 alpha-2).
 *
 * **Identical to the backend's** `SUPPORTED_PHONE_COUNTRIES`
 * (`JIN_VA-BACKEND/src/common/constants/supported-phone-countries.constants.ts`).
 * Change both together. The same list drives `/locations/suggestions` and which
 * Region files exist. Launch list = requirements Q9: Ghana plus the 15 other
 * West African countries.
 */
export const SUPPORTED_PHONE_COUNTRIES = [
  "GH",
  "BJ",
  "BF",
  "CV",
  "CI",
  "GM",
  "GN",
  "GW",
  "LR",
  "ML",
  "MR",
  "NE",
  "NG",
  "SN",
  "SL",
  "TG",
] as const satisfies readonly CountryCode[]

export type SupportedPhoneCountry = (typeof SUPPORTED_PHONE_COUNTRIES)[number]

/** Preselected and pinned first in the picker (PH1, DI6). Never Benin. */
export const DEFAULT_PHONE_COUNTRY: SupportedPhoneCountry = "GH"

export function isSupportedPhoneCountry(country: string | undefined | null): country is SupportedPhoneCountry {
  return !!country && (SUPPORTED_PHONE_COUNTRIES as readonly string[]).includes(country)
}

/**
 * PH4: the example shown in the helper and in the "invalid" error. Ghana's is
 * curated because the library's own (`023 123 4567`) is a valid but unfamiliar
 * prefix; every other country uses the library's mobile example.
 */
const CURATED_EXAMPLES: Partial<Record<SupportedPhoneCountry, string>> = {
  GH: "024 123 4567",
}

let displayNames: Intl.DisplayNames | null | undefined

/** "Ghana", "Côte d’Ivoire" — from `Intl.DisplayNames`, never typed by hand. */
export function getCountryName(country: string): string {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(["en"], { type: "region" })
    } catch {
      displayNames = null
    }
  }
  return displayNames?.of(country) ?? country
}

/** "233" for GH. */
export function getCallingCode(country: SupportedPhoneCountry): string {
  return getCountryCallingCode(country)
}

/** The flag emoji, built from the ISO code's regional-indicator letters. */
export function getCountryFlag(country: string): string {
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function getPhoneExample(country: SupportedPhoneCountry): string {
  return CURATED_EXAMPLES[country] ?? getExampleNumber(country, examples)?.formatNational() ?? ""
}

export interface PhoneCountryOption {
  country: SupportedPhoneCountry
  name: string
  callingCode: string
  flag: string
}

/** PH1: Ghana pinned first, then the rest sorted by display name. */
export function getPhoneCountryOptions(): { pinned: PhoneCountryOption; others: PhoneCountryOption[] } {
  const toOption = (country: SupportedPhoneCountry): PhoneCountryOption => ({
    country,
    name: getCountryName(country),
    callingCode: getCallingCode(country),
    flag: getCountryFlag(country),
  })
  const others = SUPPORTED_PHONE_COUNTRIES.filter((c) => c !== DEFAULT_PHONE_COUNTRY)
    .map(toOption)
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
  return { pinned: toOption(DEFAULT_PHONE_COUNTRY), others }
}

/**
 * PH3: what an input that starts with `+CC` / `00CC` means.
 *
 * - `none`: national input (no `+`/`00`), read against the selected country.
 * - `pending`: an international prefix whose calling code isn't complete yet
 *   (`+`, `+2`, `+23`) — nothing to do until more digits arrive.
 * - `supported`: the calling code is one of ours. `national` is what the field
 *   should show instead (the code moves into the picker), formatted when the
 *   number is already complete and valid.
 * - `unsupported`: a complete calling code that isn't in the list.
 */
export type InternationalInput =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "supported"; country: SupportedPhoneCountry; national: string }
  | { kind: "unsupported" }

// Every calling code in the world is 1–3 digits.
const MAX_CALLING_CODE_LENGTH = 3

export function readInternationalInput(raw: string): InternationalInput {
  const trimmed = raw.trim()
  const isPlus = trimmed.startsWith("+")
  const isDoubleZero = !isPlus && /^00/.test(trimmed.replace(/[\s().-]/g, ""))
  if (!isPlus && !isDoubleZero) return { kind: "none" }

  let digits = trimmed.replace(/\D/g, "")
  if (isDoubleZero) digits = digits.slice(2)
  if (digits === "") return { kind: "pending" }

  const parsed = parsePhoneNumberFromString(`+${digits}`)
  // The country libphonenumber assigns from the number range, when it can
  // (a shared code like +44 is GB, GG, JE or IM depending on the number).
  if (parsed?.country) {
    if (!isSupportedPhoneCountry(parsed.country)) {
      return parsed.isValid() ? { kind: "unsupported" } : matchCallingCode(trimmed, digits, isDoubleZero)
    }
    return {
      kind: "supported",
      country: parsed.country,
      national: parsed.isValid()
        ? parsed.formatNational()
        : afterCallingCode(trimmed, getCallingCode(parsed.country), isDoubleZero),
    }
  }
  return matchCallingCode(trimmed, digits, isDoubleZero)
}

function matchCallingCode(trimmed: string, digits: string, isDoubleZero: boolean): InternationalInput {
  for (const country of SUPPORTED_PHONE_COUNTRIES) {
    const code = getCallingCode(country)
    if (digits.startsWith(code)) {
      return { kind: "supported", country, national: afterCallingCode(trimmed, code, isDoubleZero) }
    }
  }
  return digits.length >= MAX_CALLING_CODE_LENGTH ? { kind: "unsupported" } : { kind: "pending" }
}

/**
 * What the user wrote after `+CC` / `00CC`, with their own spacing kept
 * (`+233 24 123 456` → `24 123 456`), for a number that isn't complete yet.
 * A typed trunk 0 is kept too, so `+2330241…` reads `0241…`.
 */
function afterCallingCode(trimmed: string, code: string, isDoubleZero: boolean): string {
  let skip = (isDoubleZero ? 2 : 0) + code.length
  let i = 0
  while (i < trimmed.length && skip > 0) {
    if (/\d/.test(trimmed[i])) skip--
    i++
  }
  return trimmed.slice(i).replace(/^[\s.-]+/, "")
}

/**
 * PH2/PH7: the E.164 value to submit (`+233241234567`), or `null` when the
 * input is empty, invalid for `country`, or from a country we don't accept.
 * A `+CC`/`00CC` prefix overrides `country`.
 */
export function phoneToE164(raw: string, country: SupportedPhoneCountry): string | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const international = readInternationalInput(trimmed)
  if (international.kind === "unsupported" || international.kind === "pending") return null
  const [input, region] =
    international.kind === "supported" ? [international.national, international.country] : [trimmed, country]
  const parsed = parsePhoneNumberFromString(input, region)
  if (!parsed?.isValid() || !isSupportedPhoneCountry(parsed.country)) return null
  return parsed.number
}

/** PH5: the national display form on blur (`024 123 4567`), or `null` if not valid. */
export function formatPhoneNational(raw: string, country: SupportedPhoneCountry): string | null {
  const e164 = phoneToE164(raw, country)
  return e164 ? (parsePhoneNumberFromString(e164)?.formatNational() ?? null) : null
}

/**
 * PH11: a stored E.164 number split back into the picker country and the
 * national form shown in the field. A value that isn't a supported, valid
 * number comes back as-is under the default country, so nothing is lost.
 */
export function splitStoredPhone(stored: string | null | undefined): {
  country: SupportedPhoneCountry
  national: string
} {
  if (!stored) return { country: DEFAULT_PHONE_COUNTRY, national: "" }
  const parsed = parsePhoneNumberFromString(stored, DEFAULT_PHONE_COUNTRY)
  if (parsed?.isValid() && isSupportedPhoneCountry(parsed.country)) {
    return { country: parsed.country, national: parsed.formatNational() }
  }
  return { country: DEFAULT_PHONE_COUNTRY, national: stored }
}

/**
 * PH11: what an edit form (settings, artisan profile) should send for the
 * phone, or the field error to show instead. A field left as it was loaded is
 * never re-sent, so a stored value the E.164 migration couldn't convert never
 * blocks saving the rest of the form; anything edited must be a valid,
 * supported number (phone is required, D4).
 */
export function phoneUpdateFor(
  stored: string | null | undefined,
  raw: string,
  country: SupportedPhoneCountry,
): { phoneNumber?: string; error?: string } {
  const loaded = splitStoredPhone(stored)
  if (raw.trim() === loaded.national.trim() && country === loaded.country) return {}
  const error = validatePhoneNumber(raw, country)
  if (error) return { error }
  const e164 = phoneToE164(raw, country)
  return e164 && e164 !== stored ? { phoneNumber: e164 } : {}
}

/** Copy (design-spec §3.3 / §6.1). */
export const PHONE_MESSAGES = {
  required: "Enter your phone number",
  invalid: (country: SupportedPhoneCountry) =>
    `Enter a valid ${getCountryName(country)} number, like ${getPhoneExample(country)}`,
  unsupported: "We can't take numbers from this country yet. Use a number from a country in the list.",
  inUse: "This number is already used by another JinVa account. Enter a different number.",
  hint: (country: SupportedPhoneCountry) =>
    `We'll use this for booking updates. For example, ${getPhoneExample(country)}.`,
} as const

/**
 * The V-treatment check for a phone field. `requireValue: false` is the blur
 * rule (an empty field is not an error until submit, V4).
 */
export function validatePhoneNumber(
  raw: string,
  country: SupportedPhoneCountry,
  { requireValue = true }: { requireValue?: boolean } = {},
): string | null {
  if (raw.trim() === "") return requireValue ? PHONE_MESSAGES.required : null
  if (readInternationalInput(raw).kind === "unsupported") return PHONE_MESSAGES.unsupported
  return phoneToE164(raw, country) ? null : PHONE_MESSAGES.invalid(country)
}
