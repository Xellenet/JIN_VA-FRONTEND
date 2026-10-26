"use client"

import type React from "react"
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { Check, ChevronDown, Loader2, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { FormFieldLabel, FormFieldMessage, fieldControlProps } from "@/components/forms/form-field"
import { apiFetch } from "@/lib/api"
import { getCountryName, type SupportedPhoneCountry } from "@/lib/phone"
import { loadRegions, matchRegion, normaliseRegionName } from "@/lib/regions"
import { cn } from "@/lib/utils"

/**
 * LOC1–LOC9, LOC11 (google-signup-prefill, design-spec §3.4): "Town or area"
 * and "Region" for artisans, both driven by the phone picker's country.
 *
 * Both are plain WAI-ARIA comboboxes (a real `<input role="combobox">` plus a
 * `role="listbox"` panel), the hand-off's stated fallback to cmdk: cmdk 1.x
 * selects its first item whenever the list renders, so Enter would silently
 * swap in a suggestion (§3.4.2 forbids that), and its keyboard handling lives
 * on its own root rather than on a free-text input that has to keep focus.
 *
 * Town: free text always wins (LOC6). Suggestions come only from JinVa's
 * `GET /locations/suggestions` — never from Photon directly — after 2
 * characters and a 250 ms pause, with `credentials: "omit"`, nothing but the
 * typed text and the country in the URL, and nothing on focus, autofill or a
 * country change (PR1, §3.4.4). Any failure, timeout or `available: false`
 * looks exactly like "no match" (LOC8). Results are kept in memory only.
 *
 * Region: a closed list from the bundled GeoNames file for the country
 * (LOC5, LOC7). A country with no file yet takes free text.
 */

export const LOCATION_MAX_LENGTH = 150
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250
const CLIENT_TIMEOUT_MS = 2000
const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright"

export const LOCATION_MESSAGES = {
  townRequired: "Enter your town or area",
  townTooLong: "Shorten to 150 characters or fewer (town and region together)",
  townHint: "Start typing and pick from the list, or type your own.",
  townNoMatch: "Not on our list? That's fine — we'll save it as you type it.",
  regionRequired: "Choose your region",
  regionNotOnList: "Choose your region from the list",
  regionHint: (country: string) => `Regions in ${getCountryName(country)}, from your phone number's country.`,
  regionFreeTextHint: (country: string) => `Your region or state in ${getCountryName(country)}.`,
  regionFromTown: "Filled in from your town. You can change it.",
} as const

/** LOC11: the single stored string, e.g. "East Legon, Greater Accra". */
export function formatLocation(town: string, region: string): string {
  return [town.trim(), region.trim()].filter(Boolean).join(", ")
}

export function validateTown(
  town: string,
  region: string,
  { requireValue }: { requireValue: boolean },
): string | null {
  if (!town.trim()) return requireValue ? LOCATION_MESSAGES.townRequired : null
  if (formatLocation(town, region).length > LOCATION_MAX_LENGTH) return LOCATION_MESSAGES.townTooLong
  return null
}

/** `regions === null`: no closed list for the country, free text accepted. */
export function validateRegion(
  region: string,
  regions: readonly string[] | null,
  { requireValue }: { requireValue: boolean },
): string | null {
  if (!region.trim()) return requireValue ? LOCATION_MESSAGES.regionRequired : null
  if (regions && !matchRegion(region, regions)) return LOCATION_MESSAGES.regionNotOnList
  return null
}

/** The country's Region list: `undefined` while loading, `null` when there is none. */
export function useRegionList(country: string): string[] | null | undefined {
  const [state, setState] = useState<{ country: string; regions: string[] | null } | null>(null)
  useEffect(() => {
    let live = true
    loadRegions(country).then((regions) => {
      if (live) setState({ country, regions })
    })
    return () => {
      live = false
    }
  }, [country])
  return state?.country === country ? state.regions : undefined
}

export interface LocationSuggestion {
  name: string
  region: string | null
  city?: string
  countryCode: string
}

interface SuggestionsResponse {
  suggestions?: LocationSuggestion[]
  available?: boolean
}

/** Region as shown in a row: the list's spelling, else Photon's without " Region". */
function displayRegion(region: string | null, regions: readonly string[] | null | undefined): string {
  if (!region) return ""
  return (regions && matchRegion(region, regions)) || region.replace(/\s+(region|state|province)$/i, "").trim()
}

/** The typed text in bold inside a suggestion name (§3.4.2). */
function highlight(name: string, query: string): React.ReactNode {
  const q = query.trim()
  const at = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (at < 0) return name
  return (
    <>
      {name.slice(0, at)}
      <b className="font-semibold">{name.slice(at, at + q.length)}</b>
      {name.slice(at + q.length)}
    </>
  )
}

/** Browser autofill / a picked saved value: accepted as free text, no lookup. */
function isAutofill(e: React.ChangeEvent<HTMLInputElement>): boolean {
  const inputType = (e.nativeEvent as InputEvent).inputType
  return !inputType || inputType === "insertReplacementText"
}

function regionWordMatch(region: string, query: string): boolean {
  const q = normaliseRegionName(query)
  if (!q) return true
  return ` ${normaliseRegionName(region)}`.includes(` ${q}`)
}

const PANEL_CLASS =
  "absolute left-0 right-0 z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
const OPTION_CLASS =
  "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"

export interface LocationFieldsProps {
  /** The phone picker's country (LOC2). */
  country: SupportedPhoneCountry
  /** From `useRegionList(country)`. */
  regions: string[] | null | undefined
  town: string
  region: string
  onTownChange: (value: string) => void
  onRegionChange: (value: string) => void
  onTownBlur?: () => void
  onRegionBlur?: () => void
  townError?: React.ReactNode
  regionError?: React.ReactNode
  onAnnounce?: (message: string) => void
  /** Where focus goes once a town or region is chosen (e.g. "hourlyRate"). */
  nextFocusId?: string
  disabled?: boolean
  townId?: string
  regionId?: string
}

export function LocationFields({
  country,
  regions,
  town,
  region,
  onTownChange,
  onRegionChange,
  onTownBlur,
  onRegionBlur,
  townError,
  regionError,
  onAnnounce,
  nextFocusId,
  disabled,
  townId = "town",
  regionId = "region",
}: Readonly<LocationFieldsProps>) {
  const rowRef = useRef<HTMLDivElement>(null)
  const regionInputRef = useRef<HTMLInputElement>(null)
  const [regionFromTown, setRegionFromTown] = useState(false)

  // LOC2: on a country change, keep the town; clear Region unless the new
  // country's list has the same name. Runs once the new list has loaded.
  const regionRef = useRef(region)
  regionRef.current = region
  const listCountry = useRef<string | null>(null)
  useEffect(() => {
    if (regions === undefined) return
    const previous = listCountry.current
    listCountry.current = country
    if (previous === null || previous === country) return
    const current = regionRef.current
    if (!current.trim()) return
    const kept = regions ? matchRegion(current, regions) : null
    if (kept) {
      if (kept !== current) onRegionChange(kept)
      return
    }
    onRegionChange("")
    setRegionFromTown(false)
    onAnnounce?.(`Region cleared. Choose a region in ${getCountryName(country)}.`)
  }, [country, regions, onRegionChange, onAnnounce])

  const focusNext = () => {
    const el = nextFocusId ? document.getElementById(nextFocusId) : null
    el?.focus()
  }

  const chooseTown = (suggestion: LocationSuggestion) => {
    onTownChange(suggestion.name)
    const matched = regions ? matchRegion(suggestion.region, regions) : null
    if (matched) {
      onRegionChange(matched)
      setRegionFromTown(true)
      onAnnounce?.(`${suggestion.name} chosen. Region set to ${matched}.`)
    } else {
      onAnnounce?.(`${suggestion.name} chosen.`)
    }
    // Region already done → straight on (R2-c); otherwise Region is next.
    if (matched || regionRef.current.trim()) focusNext()
    else regionInputRef.current?.focus()
  }

  const regionHint = regionFromTown
    ? LOCATION_MESSAGES.regionFromTown
    : regions === null
      ? LOCATION_MESSAGES.regionFreeTextHint(country)
      : LOCATION_MESSAGES.regionHint(country)

  return (
    <div ref={rowRef} className="relative grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TownCombobox
        id={townId}
        country={country}
        regions={regions}
        value={town}
        onChange={onTownChange}
        onBlur={onTownBlur}
        onChoose={chooseTown}
        error={townError}
        disabled={disabled}
        onAnnounce={onAnnounce}
        rowRef={rowRef}
      />
      <RegionCombobox
        id={regionId}
        inputRef={regionInputRef}
        regions={regions}
        value={region}
        onChange={(value, { fromList }) => {
          onRegionChange(value)
          if (!fromList) setRegionFromTown(false)
        }}
        onChosen={focusNext}
        onBlur={onRegionBlur}
        error={regionError}
        hint={regionHint}
        disabled={disabled}
      />
    </div>
  )
}

// ── Town or area ──────────────────────────────────────────────────────────────

const suggestionCache = new Map<string, LocationSuggestion[]>()

function TownCombobox({
  id,
  country,
  regions,
  value,
  onChange,
  onBlur,
  onChoose,
  error,
  disabled,
  onAnnounce,
  rowRef,
}: {
  id: string
  country: SupportedPhoneCountry
  regions: string[] | null | undefined
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  onChoose: (suggestion: LocationSuggestion) => void
  error?: React.ReactNode
  disabled?: boolean
  onAnnounce?: (message: string) => void
  rowRef: React.RefObject<HTMLDivElement | null>
}) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<LocationSuggestion[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const [noMatch, setNoMatch] = useState(false)
  const [panelTop, setPanelTop] = useState(0)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef<AbortController | null>(null)
  const requestSeq = useRef(0)

  const cancelPending = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    inFlight.current?.abort()
    inFlight.current = null
    requestSeq.current++
    setLoading(false)
  }, [])

  useEffect(() => cancelPending, [cancelPending])

  // The panel spans the whole Town | Region row, just under the Town input.
  useLayoutEffect(() => {
    if (!open || !inputRef.current || !rowRef.current) return
    const input = inputRef.current.getBoundingClientRect()
    const row = rowRef.current.getBoundingClientRect()
    setPanelTop(input.bottom - row.top + 4)
  }, [open, rowRef])

  const showResults = (results: LocationSuggestion[], text: string) => {
    setQuery(text)
    setActive(-1)
    if (results.length > 0) {
      setItems(results)
      setNoMatch(false)
      setOpen(true)
      onAnnounce?.(`${results.length} suggestions. Use up and down arrows to choose.`)
    } else {
      setItems([])
      setNoMatch(true)
      setOpen(false)
      onAnnounce?.("No suggestions. You can keep typing.")
    }
  }

  const lookUp = async (text: string) => {
    const key = `${country}|${text.toLowerCase()}`
    const cached = suggestionCache.get(key)
    if (cached) {
      showResults(cached, text)
      return
    }
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    const seq = ++requestSeq.current
    const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)
    // First lookup shows "Looking for places…"; later ones keep the old rows.
    setLoading(true)
    if (items.length === 0) setOpen(true)
    let results: LocationSuggestion[] = []
    try {
      const params = new URLSearchParams({ q: text, country })
      const data = await apiFetch<SuggestionsResponse>(`/locations/suggestions?${params}`, {
        skipAuth: true,
        credentials: "omit",
        signal: controller.signal,
      })
      results = Array.isArray(data?.suggestions) ? data.suggestions : []
      // Only a real answer is cached; "unavailable" may recover in a moment.
      if (data?.available !== false) suggestionCache.set(key, results)
    } catch {
      results = [] // LOC8: down, slow, throttled or offline looks like "no match".
    } finally {
      clearTimeout(timeout)
    }
    if (seq !== requestSeq.current) return
    inFlight.current = null
    setLoading(false)
    showResults(results, text)
  }

  const close = () => {
    setOpen(false)
    setActive(-1)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    onChange(next)
    cancelPending()
    const text = next.trim()
    if (isAutofill(e) || text.length < MIN_QUERY_LENGTH) {
      close()
      setItems([])
      if (text.length < MIN_QUERY_LENGTH) setNoMatch(false)
      return
    }
    timer.current = setTimeout(() => void lookUp(text), DEBOUNCE_MS)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = items.length
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (count === 0) return
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(e.key === "ArrowDown" ? 0 : count - 1)
        return
      }
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % count : i <= 0 ? count - 1 : i - 1))
    } else if (e.key === "Enter" && open) {
      // Enter never submits while the list is open (LOC3).
      e.preventDefault()
      if (active >= 0 && items[active]) {
        close()
        onChoose(items[active])
      } else {
        close()
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }

  const handleWidgetBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    cancelPending()
    close()
    const trimmed = value.trim()
    if (trimmed !== value) onChange(trimmed)
    onBlur?.()
  }

  const showRows = open && items.length > 0
  const showLoadingRow = open && items.length === 0 && loading
  const hint = noMatch ? LOCATION_MESSAGES.townNoMatch : LOCATION_MESSAGES.townHint
  const optionId = (i: number) => `${listId}-option-${i}`
  const control = fieldControlProps(id, { error, hint })

  return (
    <div className="space-y-2 scroll-mt-24" onBlur={handleWidgetBlur}>
      <FormFieldLabel htmlFor={id} invalid={!!error}>
        Town or area
      </FormFieldLabel>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          {...control}
          ref={inputRef}
          name="town"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showRows || showLoadingRow}
          aria-controls={listId}
          aria-activedescendant={showRows && active >= 0 ? optionId(active) : undefined}
          autoComplete="address-level2"
          autoCapitalize="words"
          enterKeyHint="next"
          required
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="h-10 pl-9 bg-background border-input text-foreground"
        />
      </div>
      <FormFieldMessage id={id} hint={hint} error={error} />

      {(showRows || showLoadingRow) && (
        <div className={PANEL_CLASS} style={{ top: panelTop }}>
          <ul id={listId} role="listbox" aria-label="Town suggestions" className="max-h-80 overflow-y-auto p-1">
            {showLoadingRow ? (
              <li role="presentation" className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Looking for places&hellip;
              </li>
            ) : (
              items.map((item, i) => {
                const place = displayRegion(item.region, regions)
                const detail = [item.city, place].filter(Boolean).join(", ")
                return (
                  <li
                    key={`${item.name}|${item.city ?? ""}|${item.region ?? ""}|${i}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    // Keep focus in the input; the click chooses.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      close()
                      onChoose(item)
                    }}
                    className={cn(OPTION_CLASS, i === active && "bg-accent text-accent-foreground")}
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">{highlight(item.name, query)}</span>
                    {detail && <span className="shrink-0 text-xs text-muted-foreground">{detail}</span>}
                  </li>
                )
              })
            )}
          </ul>
          {showRows && (
            // LOC9: OSM credit whenever suggestions are on screen.
            <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
              Suggestions ©{" "}
              <a
                href={OSM_COPYRIGHT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                OpenStreetMap contributors
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Region ────────────────────────────────────────────────────────────────────

function RegionCombobox({
  id,
  inputRef,
  regions,
  value,
  onChange,
  onChosen,
  onBlur,
  error,
  hint,
  disabled,
}: {
  id: string
  inputRef: React.RefObject<HTMLInputElement | null>
  regions: string[] | null | undefined
  value: string
  onChange: (value: string, opts: { fromList: boolean }) => void
  onChosen: () => void
  onBlur?: () => void
  error?: React.ReactNode
  hint: string
  disabled?: boolean
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const [active, setActive] = useState(-1)
  const control = fieldControlProps(id, { error, hint })

  // No closed list for this country (yet): a plain required text field.
  if (regions === null) {
    return (
      <div className="space-y-2 scroll-mt-24">
        <FormFieldLabel htmlFor={id} invalid={!!error}>
          Region
        </FormFieldLabel>
        <Input
          {...control}
          ref={inputRef}
          name="region"
          type="text"
          autoComplete="address-level1"
          autoCapitalize="words"
          enterKeyHint="next"
          required
          value={value}
          onChange={(e) => onChange(e.target.value, { fromList: false })}
          onBlur={() => {
            if (value.trim() !== value) onChange(value.trim(), { fromList: false })
            onBlur?.()
          }}
          disabled={disabled}
          className="h-10 bg-background border-input text-foreground"
        />
        <FormFieldMessage id={id} hint={hint} error={error} />
      </div>
    )
  }

  const list = regions ?? []
  const filtered = list.filter((r) => regionWordMatch(r, filter))
  const current = regions ? matchRegion(value, regions) : null
  const optionId = (i: number) => `${listId}-option-${i}`

  /** `showAll`: the whole list (click, or ↓ on a chosen value); else filtered by the text. */
  const openList = (showAll: boolean) => {
    setFilter(showAll ? "" : value)
    setActive(-1)
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    setActive(-1)
  }
  const choose = (region: string) => {
    onChange(region, { fromList: true })
    close()
    onChosen()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    if (isAutofill(e)) {
      // An autofilled value is matched like a blur (LOC5).
      onChange((regions && matchRegion(next, regions)) || next, { fromList: false })
      return
    }
    onChange(next, { fromList: false })
    setFilter(next)
    setActive(-1)
    setOpen(next.trim().length > 0 || open)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = filtered.length
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) {
        openList(!!current || !value.trim())
        return
      }
      if (count === 0) return
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % count : i <= 0 ? count - 1 : i - 1))
    } else if (e.key === "Enter" && open) {
      e.preventDefault()
      if (active >= 0 && filtered[active]) choose(filtered[active])
      else close()
    } else if (e.key === "Escape" && open) {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }

  const handleWidgetBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    close()
    // Closed list: an exact (normalised) match is accepted in the list's spelling.
    const matched = regions ? matchRegion(value, regions) : null
    if (matched && matched !== value) onChange(matched, { fromList: false })
    else if (value.trim() !== value) onChange(value.trim(), { fromList: false })
    onBlur?.()
  }

  return (
    <div className="space-y-2 scroll-mt-24" onBlur={handleWidgetBlur}>
      <FormFieldLabel htmlFor={id} invalid={!!error}>
        Region
      </FormFieldLabel>
      <div className="relative">
        <Input
          {...control}
          ref={inputRef}
          name="region"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          autoComplete="address-level1"
          autoCapitalize="words"
          enterKeyHint="next"
          required
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={() => (open ? close() : openList(true))}
          disabled={disabled}
          className="h-10 pr-9 bg-background border-input text-foreground"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-50"
          aria-hidden="true"
        />
        {open && (
          <div className={cn(PANEL_CLASS, "top-[calc(100%+4px)]")}>
          <ul id={listId} role="listbox" aria-label="Regions" className="max-h-64 overflow-y-auto p-1">
            {regions === undefined ? (
              <li role="presentation" className="px-2 py-1.5 text-sm text-muted-foreground">
                Loading regions&hellip;
              </li>
            ) : filtered.length === 0 ? (
              <li role="presentation" className="px-2 py-1.5 text-sm text-muted-foreground">
                No region matches. Check the spelling.
              </li>
            ) : (
              filtered.map((region, i) => (
                <li
                  key={region}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(region)}
                  className={cn(OPTION_CLASS, i === active && "bg-accent text-accent-foreground")}
                >
                  <Check
                    className={cn("size-4 shrink-0", region === current ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  {region}
                </li>
              ))
            )}
          </ul>
          </div>
        )}
      </div>
      <FormFieldMessage id={id} hint={hint} error={error} />
    </div>
  )
}
