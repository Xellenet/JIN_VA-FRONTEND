/**
 * The landing page's search form and signup links, as pure functions.
 *
 * Pure on purpose (no React, no Next imports) so `scripts/test-landing-search.mjs`
 * runs it directly with Node's type stripping.
 *
 * The search form only ever produces two query params for the customer search
 * page, `serviceId` and `location`, and the search page reads them back through
 * `readCustomerSearchSeed`, so both ends sanitise the same way. A signed-out
 * visitor is sent on by `src/middleware.ts` to `/login?redirect=<this url>`, and
 * the login form passes that through `safeInternalRedirect`, so nothing here is
 * ever a redirect target on its own.
 */

/** The customer search route (`src/app/dashboard/user/search/page.tsx`). */
export const CUSTOMER_SEARCH_PATH = "/dashboard/user/search"

/** Longest place text the form accepts (the input's `maxLength` too). */
export const LOCATION_MAX_LENGTH = 80

/** Service ids are numeric today; this also allows a uuid if that changes. */
const SERVICE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/

/**
 * Anything that is not a letter, mark, digit, space or the punctuation a
 * Ghanaian address uses (`Osu, Accra`, `East Legon - Block 3`, `St. John's`).
 * Angle brackets, quotes, control characters, `&`, `#`, `?`, `%` and the like
 * are dropped rather than escaped: they only ever become a query param value,
 * but there is no place name that needs them.
 */
const LOCATION_DISALLOWED = /[^\p{L}\p{M}\p{N} ,.'’()/-]/gu

/** Place text, trimmed, single-spaced, stripped of odd characters and capped. */
export function sanitiseLocation(value: unknown): string {
  if (typeof value !== "string") return ""
  return value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(LOCATION_DISALLOWED, "")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, LOCATION_MAX_LENGTH)
    .trim()
}

/** A service id from the catalogue, or "" for anything that cannot be one. */
export function sanitiseServiceId(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return ""
  const id = String(value).trim()
  return SERVICE_ID_PATTERN.test(id) ? id : ""
}

export interface CustomerSearchSeed {
  serviceId: string
  location: string
}

/** `/dashboard/user/search`, plus `?serviceId=…&location=…` for whatever is set. */
export function buildCustomerSearchHref(input: Partial<Record<keyof CustomerSearchSeed, unknown>>): string {
  const params = new URLSearchParams()
  const serviceId = sanitiseServiceId(input.serviceId)
  const location = sanitiseLocation(input.location)
  if (serviceId) params.set("serviceId", serviceId)
  if (location) params.set("location", location)
  const query = params.toString()
  return query ? `${CUSTOMER_SEARCH_PATH}?${query}` : CUSTOMER_SEARCH_PATH
}

/** The filters a search URL carries, sanitised. Unknown params are ignored. */
export function readCustomerSearchSeed(search: URLSearchParams | string | null | undefined): CustomerSearchSeed {
  const params = typeof search === "string" || !search ? new URLSearchParams(search ?? "") : search
  return {
    serviceId: sanitiseServiceId(params.get("serviceId")),
    location: sanitiseLocation(params.get("location")),
  }
}

/**
 * Signup links. Only these two roles exist, and only `role` is ever set: the
 * signup form reads `?role=CUSTOMER|ARTISAN` (`roleFromParam` in
 * `src/lib/signup-flow.ts`) and ignores anything else.
 */
const SIGNUP_ROLE_PARAM = { client: "CUSTOMER", artisan: "ARTISAN" } as const

export type SignupAudience = keyof typeof SIGNUP_ROLE_PARAM

export function signupHref(audience: SignupAudience): string {
  return Object.hasOwn(SIGNUP_ROLE_PARAM, audience) ? `/signup?role=${SIGNUP_ROLE_PARAM[audience]}` : "/signup"
}

export interface CatalogueService {
  id: string
  name: string
}

/**
 * `GET /services` → `{ id, name }[]` for the select. Accepts the bare array or
 * `{ items }`, drops anything without a usable id or name, and keeps the API's
 * order. Names are capped so a long one cannot stretch the form.
 */
export function toCatalogueOptions(data: unknown): CatalogueService[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
      ? ((data as { items: unknown[] }).items)
      : []
  const seen = new Set<string>()
  const out: CatalogueService[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const { id, name, isActive } = item as { id?: unknown; name?: unknown; isActive?: unknown }
    if (isActive === false) continue
    const safeId = sanitiseServiceId(id as string)
    const safeName = typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, 60) : ""
    if (!safeId || !safeName || seen.has(safeId)) continue
    seen.add(safeId)
    out.push({ id: safeId, name: safeName })
  }
  return out
}
