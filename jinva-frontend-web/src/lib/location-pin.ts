/**
 * Exact location (the Uber-style pin): pure helpers shared by the picker, the
 * forms that send a pin and the artisan views that show one.
 *
 * Pure: no runtime imports, so `scripts/test-location-pin.mjs` runs it
 * directly with Node's type stripping.
 *
 * Why the GPS rules look like this: a laptop has no GPS and is placed by its
 * internet connection, which in Ghana often resolves to Accra wherever the
 * person is. Phones get a few metres outdoors, but the first reading is often
 * rough and improves over a few seconds. So we watch the position, keep the
 * best reading, stop once it is good enough or after a while, and never move
 * the map to a reading that is only a guess.
 */

// ── Thresholds ───────────────────────────────────────────────────────────────

/** Stop watching once a reading is this accurate (metres). */
export const GPS_GOOD_ENOUGH_M = 25
/** Stop watching after this long and keep the best reading so far. */
export const GPS_WATCH_LIMIT_MS = 20_000
/** Rougher than this (metres) is not GPS: the device is guessing from its network. */
export const NO_GPS_ACCURACY_M = 1_000
/** Rougher than this is still used, with a "check the pin" note. */
export const ROUGH_ACCURACY_M = 100

/** A rectangle around Ghana: the API refuses a pin outside it. */
export const GHANA_BOUNDS = Object.freeze({ minLat: 4.5, maxLat: 11.2, minLon: -3.3, maxLon: 1.2 })

export const LANDMARK_MAX = 140

// ── Readings ─────────────────────────────────────────────────────────────────

export interface GpsReading {
  latitude: number
  longitude: number
  /** Radius of 68 % confidence, in metres, as the browser reports it. */
  accuracy: number
  /** ms since epoch. */
  timestamp: number
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)

/** A usable reading: finite numbers and a positive accuracy. */
export function isValidReading(r: Partial<GpsReading> | null | undefined): r is GpsReading {
  return !!r && finite(r.latitude) && finite(r.longitude) && finite(r.accuracy) && r.accuracy > 0 && Math.abs(r.latitude) <= 90 && Math.abs(r.longitude) <= 180
}

/**
 * The better of two readings: the more accurate one; on a tie, the newer one.
 * An invalid reading never wins.
 */
export function pickBestReading(best: GpsReading | null | undefined, next: GpsReading | null | undefined): GpsReading | null {
  const a = isValidReading(best) ? best : null
  const b = isValidReading(next) ? next : null
  if (!a) return b
  if (!b) return a
  if (b.accuracy < a.accuracy) return b
  if (b.accuracy === a.accuracy && b.timestamp > a.timestamp) return b
  return a
}

/** Whether the watch can stop: good enough, or out of time. */
export function shouldStopWatching(best: GpsReading | null, elapsedMs: number): boolean {
  if (best && best.accuracy <= GPS_GOOD_ENOUGH_M) return true
  return elapsedMs >= GPS_WATCH_LIMIT_MS
}

export type FixQuality = "precise" | "good" | "rough" | "no_gps"

export function fixQuality(accuracyM: number): FixQuality {
  if (accuracyM <= GPS_GOOD_ENOUGH_M) return "precise"
  if (accuracyM <= ROUGH_ACCURACY_M) return "good"
  if (accuracyM <= NO_GPS_ACCURACY_M) return "rough"
  return "no_gps"
}

/** Whether the map may centre on a reading (a network guess may be in the wrong town). */
export function canCentreOn(reading: GpsReading | null): boolean {
  return !!reading && reading.accuracy <= NO_GPS_ACCURACY_M && isInGhana(reading.latitude, reading.longitude)
}

/** Map zoom that shows a reading's accuracy circle comfortably. */
export function zoomForAccuracy(accuracyM: number | null | undefined): number {
  if (!finite(accuracyM)) return 17
  if (accuracyM <= 30) return 18
  if (accuracyM <= 80) return 17
  if (accuracyM <= 250) return 16
  return 15
}

// ── Copy ─────────────────────────────────────────────────────────────────────

/** "±8 m", "±120 m", "±1.2 km", "±25 km". */
export function accuracyText(accuracyM: number | null | undefined): string {
  if (!finite(accuracyM) || accuracyM < 0) return ""
  if (accuracyM < 1000) return `±${Math.max(1, Math.round(accuracyM))} m`
  const km = accuracyM / 1000
  return `±${km < 10 ? (Math.round(km * 10) / 10).toString() : Math.round(km)} km`
}

/** The live line while the watch runs. */
export function locatingText(best: GpsReading | null): string {
  return best ? `Finding your exact location… ${accuracyText(best.accuracy)}` : "Finding your exact location…"
}

/** What to say about a finished fix. Null when there is nothing to add. */
export function fixNote(accuracyM: number): string | null {
  switch (fixQuality(accuracyM)) {
    case "precise":
      return null
    case "good":
      return `Located to ${accuracyText(accuracyM)}. Move the map if the pin isn't on the spot.`
    case "rough":
      return `Your location is only approximate (${accuracyText(accuracyM)}). Move the map to put the pin on the exact spot.`
    case "no_gps":
      return `This device can't tell exactly where you are (${accuracyText(accuracyM)}). A phone with location on gives an exact spot, or move the map to put the pin on the place by hand.`
  }
}

export type GeoErrorReason = "denied" | "unavailable" | "timeout" | "unsupported" | "insecure"

/** GeolocationPositionError codes (1, 2, 3) to a reason. */
export function geoErrorReason(code: number): GeoErrorReason {
  if (code === 1) return "denied"
  if (code === 2) return "unavailable"
  return "timeout"
}

const MANUAL = "You can still move the map to put the pin on the place."

export function geoErrorText(reason: GeoErrorReason, inAppBrowser = false): string {
  switch (reason) {
    case "denied":
      return inAppBrowser
        ? `This app's built-in browser doesn't share your location. Open JinVa in your browser (Chrome or Safari) and try again. ${MANUAL}`
        : `Location is blocked for JinVa. Allow it in your browser's site settings, then tap Locate me. ${MANUAL}`
    case "unavailable":
      return `Your device couldn't find your location. Turn on location (GPS) and tap Locate me. ${MANUAL}`
    case "timeout":
      return `Finding your location took too long. Try again near a window or outside. ${MANUAL}`
    case "unsupported":
      return inAppBrowser
        ? `This app's built-in browser can't share your location. Open JinVa in your browser (Chrome or Safari). ${MANUAL}`
        : `This browser can't share your location. ${MANUAL}`
    case "insecure":
      return `Location only works on a secure (https) connection. ${MANUAL}`
  }
}

/**
 * In-app browsers (Facebook, Instagram, TikTok, Snapchat, LINE, X, Android
 * WebViews) often block location without asking.
 */
export function isInAppBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Snapchat|TikTok|musical_ly|BytedanceWebview|Line\/|Twitter|; wv\)/i.test(userAgent)
}

// ── Geometry ─────────────────────────────────────────────────────────────────

export function isInGhana(lat: number, lon: number): boolean {
  return finite(lat) && finite(lon) && lat >= GHANA_BOUNDS.minLat && lat <= GHANA_BOUNDS.maxLat && lon >= GHANA_BOUNDS.minLon && lon <= GHANA_BOUNDS.maxLon
}

/** Six decimals (about 0.1 m), what the API stores. */
export function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/**
 * The key a reverse lookup is cached under. Three decimals (about 100 m),
 * the same rounding the API applies before asking the geocoder, so moving the
 * map a few metres doesn't spend a lookup.
 */
export function labelKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}

/** "6.68850° N, 1.62440° W", for the text alternative to the map. */
export function coordsText(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S"
  const ew = lon >= 0 ? "E" : "W"
  return `${Math.abs(lat).toFixed(5)}° ${ns}, ${Math.abs(lon).toFixed(5)}° ${ew}`
}

/** Great-circle distance in metres (haversine). */
export function distanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6_371_008.8
  const rad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * rad
  const dLon = (b.longitude - a.longitude) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * The accuracy to store for a pin: the GPS accuracy while the pin is still
 * inside the GPS circle (the person only nudged it), else null (placed by hand).
 */
export function pinAccuracy(pin: { latitude: number; longitude: number }, fix: GpsReading | null): number | null {
  if (!fix || fix.accuracy > NO_GPS_ACCURACY_M) return null
  return distanceM(pin, fix) <= Math.max(fix.accuracy, 10) ? Math.round(fix.accuracy) : null
}

/**
 * A circle of `radiusM` metres around a point as a closed GeoJSON ring
 * ([lon, lat] pairs), for the accuracy circle. Equirectangular, which is
 * plenty for a few hundred metres near the equator.
 */
export function circleRing(lat: number, lon: number, radiusM: number, steps = 64): [number, number][] {
  const R = 6_371_008.8
  const dLat = (radiusM / R) * (180 / Math.PI)
  const dLon = dLat / Math.cos((lat * Math.PI) / 180)
  const ring: [number, number][] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    ring.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)])
  }
  ring.push(ring[0])
  return ring
}

// ── Where the map opens ─────────────────────────────────────────────────────

export interface MapCentre {
  latitude: number
  longitude: number
  zoom: number
  /** What the centre is, for the status line ("Showing Kumasi"). */
  name: string
}

/** Town centres the map can open at when there is no GPS fix (approximate, public). */
const TOWNS: ReadonlyArray<readonly [name: string, lat: number, lon: number, aliases?: readonly string[]]> = [
  ["Accra", 5.556, -0.1969, ["greater accra", "osu", "east legon", "madina", "dansoman", "achimota", "spintex", "labadi", "kaneshie", "adabraka", "airport residential", "cantonments", "teshie", "nungua", "lapaz", "dzorwulu", "haatso", "adenta"]],
  ["Kumasi", 6.6885, -1.6244, ["ashanti", "adum", "asokwa", "bantama", "suame", "ahodwo", "nhyiaeso", "asafo", "kwadaso", "tafo", "santasi", "atonsu", "ayeduase", "knust", "oforikrom"]],
  ["Tema", 5.6698, -0.0166, ["community 1", "sakumono", "ashaiman"]],
  ["Kasoa", 5.5345, -0.4168],
  ["Takoradi", 4.8986, -1.7554, ["sekondi", "western"]],
  ["Cape Coast", 5.1053, -1.2466, ["central region"]],
  ["Tamale", 9.4008, -0.8393, ["northern"]],
  ["Sunyani", 7.3399, -2.3268, ["bono"]],
  ["Techiman", 7.5862, -1.9381],
  ["Ho", 6.6008, 0.4713, ["volta"]],
  ["Koforidua", 6.0941, -0.2591, ["eastern"]],
  ["Obuasi", 6.2023, -1.6703],
  ["Bolgatanga", 10.7856, -0.8514, ["upper east"]],
  ["Wa", 10.0601, -2.5099, ["upper west"]],
  ["Winneba", 5.3511, -0.6231],
  ["Nkawkaw", 6.5508, -0.7664],
]

/** The default when nothing is known: Accra, the largest city. */
export const DEFAULT_CENTRE: MapCentre = { latitude: 5.556, longitude: -0.1969, zoom: 11, name: "Accra" }

const words = (s: string) => ` ${s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `

/**
 * Where to open the map for a typed address with no GPS fix: the first town
 * (or one of its well-known areas) named in it, else {@link DEFAULT_CENTRE}.
 * Whole words only, so "Hohoe" is not "Ho" and "Washington" is not "Wa".
 */
export function centreForAddress(address: string | null | undefined): MapCentre {
  const text = words(address ?? "")
  if (text.trim()) {
    let found: { index: number; centre: MapCentre } | null = null
    for (const [name, latitude, longitude, aliases = []] of TOWNS) {
      for (const term of [name, ...aliases]) {
        const index = text.indexOf(words(term))
        if (index >= 0 && (!found || index < found.index)) {
          found = { index, centre: { latitude, longitude, zoom: term === name ? 13 : 14, name } }
        }
      }
    }
    if (found) return found.centre
  }
  return DEFAULT_CENTRE
}

// ── Directions ───────────────────────────────────────────────────────────────

/**
 * Google Maps directions to a point. Opens the Google Maps app on phones that
 * have it and the website elsewhere; other map apps take the same link.
 */
export function directionsUrlFor(lat: number, lon: number): string | null {
  if (!finite(lat) || !finite(lon) || (lat === 0 && lon === 0) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${roundCoord(lat)},${roundCoord(lon)}`
}

/** A point from an API record whose numbers may arrive as strings; null when absent or invalid. */
export function pointOf(rec: { latitude?: number | string | null; longitude?: number | string | null } | null | undefined): { latitude: number; longitude: number } | null {
  if (!rec || rec.latitude == null || rec.longitude == null || rec.latitude === "" || rec.longitude === "") return null
  const latitude = Number(rec.latitude)
  const longitude = Number(rec.longitude)
  if (!finite(latitude) || !finite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  if (latitude === 0 && longitude === 0) return null
  return { latitude, longitude }
}

// ── What the forms send ──────────────────────────────────────────────────────

/** A pin the customer confirmed in the picker. */
export interface PinnedLocation {
  latitude: number
  longitude: number
  /** GPS accuracy when the pin is where GPS put it; null when placed by hand. */
  accuracyM: number | null
  /** Full reverse-geocoded label ("Prempeh II Street, Adum, Kumasi, Ashanti"). */
  label: string | null
  /** Area only ("Adum, Kumasi"): what may be shown publicly. */
  area: string | null
  /** A small JPEG of the map at the pin, for the preview. */
  snapshot: string | null
}

/**
 * The location fields for POST /jobs and POST /bookings. Nothing for an
 * absent pin (old behaviour); the landmark is trimmed and capped.
 */
export function pinPayload(pin: PinnedLocation | null, landmark: string): {
  latitude?: number
  longitude?: number
  locationAccuracyM?: number
  landmark?: string
} {
  const out: { latitude?: number; longitude?: number; locationAccuracyM?: number; landmark?: string } = {}
  if (pin && isInGhana(pin.latitude, pin.longitude)) {
    out.latitude = roundCoord(pin.latitude)
    out.longitude = roundCoord(pin.longitude)
    if (finite(pin.accuracyM) && pin.accuracyM >= 0) out.locationAccuracyM = Math.round(pin.accuracyM)
  }
  const note = landmark.trim().replace(/\s+/g, " ").slice(0, LANDMARK_MAX)
  if (note) out.landmark = note
  return out
}

/** "Pinned · ±8 m" or "Pinned by hand" for the preview. */
export function pinSummary(pin: PinnedLocation): string {
  return pin.accuracyM != null ? `Pinned · ${accuracyText(pin.accuracyM)}` : "Pinned on the map"
}

/** The map pans this many pixels per arrow key (Shift: a bigger step). */
export function panStep(key: string, shift = false): [number, number] | null {
  const d = shift ? 240 : 80
  switch (key) {
    case "ArrowUp":
      return [0, -d]
    case "ArrowDown":
      return [0, d]
    case "ArrowLeft":
      return [-d, 0]
    case "ArrowRight":
      return [d, 0]
    default:
      return null
  }
}
