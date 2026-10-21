/**
 * LOC4/LOC5: region matching. Case and diacritics are ignored, whitespace is
 * collapsed, and a trailing " Region", " State" or " Province" is dropped, so
 * Photon's "Greater Accra Region" and a typed "greater accra" both match the
 * GeoNames entry "Greater Accra". Never guesses: no fuzzy or partial match.
 *
 * No `@/` imports, so `scripts/test-phone-number.mjs` can import it directly.
 */
export function normaliseRegionName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ (region|state|province)$/, "")
}

/** The list's own spelling of `value`, or `null` when nothing matches exactly. */
export function matchRegion(value: string | null | undefined, regions: readonly string[]): string | null {
  if (!value) return null
  const wanted = normaliseRegionName(value)
  if (!wanted) return null
  return regions.find((region) => normaliseRegionName(region) === wanted) ?? null
}
