import { REGION_LOADERS } from "./loaders"

export { matchRegion, normaliseRegionName } from "./normalise"
export type { RegionFile } from "./types"

const cache = new Map<string, Promise<string[] | null>>()

/**
 * The country's complete first-level list (LOC5, LOC7), loaded on demand from
 * the bundled static file. Resolves to `null` for a country with no file yet.
 * Never calls GeoNames or any other service.
 */
export function loadRegions(country: string): Promise<string[] | null> {
  let pending = cache.get(country)
  if (!pending) {
    const loader = REGION_LOADERS[country]
    pending = loader
      ? loader()
          .then((file) => file.regions)
          .catch(() => {
            cache.delete(country)
            return null
          })
      : Promise.resolve(null)
    cache.set(country, pending)
  }
  return pending
}

export function hasRegionList(country: string): boolean {
  return !!REGION_LOADERS[country]
}
