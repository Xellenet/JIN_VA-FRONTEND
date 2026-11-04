#!/usr/bin/env node
/**
 * The exact-location helpers (`src/lib/location-pin.ts`): best-reading
 * selection, when the GPS watch stops, accuracy copy, Ghana bounds, where the
 * map opens, the directions URL and what the forms send.
 *
 * Run: `npm run test:location`. Same convention as the other scripts: no test
 * runner, the shipped module imported through Node's type stripping, exit 1 on
 * failure. No network. Fictional coordinates only (Adum, Kumasi).
 */
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const L = await import(pathToFileURL(join(process.cwd(), "src", "lib", "location-pin.ts")).href)
const J = await import(pathToFileURL(join(process.cwd(), "src", "lib", "artisan-jobs.ts")).href)

let failures = 0
let passed = 0
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    failures++
    console.error(`FAIL ${label}: expected ${e}, got ${a}`)
  } else passed++
}

const ADUM = { latitude: 6.6885, longitude: -1.6244 }
const reading = (accuracy, timestamp = 1, dLat = 0) => ({ latitude: ADUM.latitude + dLat, longitude: ADUM.longitude, accuracy, timestamp })

// ── Best reading ────────────────────────────────────────────────────────────
check("first reading wins over nothing", L.pickBestReading(null, reading(900)), reading(900))
check("more accurate wins", L.pickBestReading(reading(900), reading(40)), reading(40))
check("less accurate never replaces", L.pickBestReading(reading(40), reading(150, 9)), reading(40))
check("tie: the newer wins", L.pickBestReading(reading(12, 1), reading(12, 2)), reading(12, 2))
check("invalid next is ignored", L.pickBestReading(reading(40), { latitude: NaN, longitude: 0, accuracy: 5, timestamp: 2 }), reading(40))
check("zero accuracy is invalid", L.pickBestReading(null, reading(0)), null)
check("out-of-range latitude is invalid", L.isValidReading({ latitude: 91, longitude: 0, accuracy: 5, timestamp: 1 }), false)
// The live sequence the picker sees: network guess, then GPS improving.
{
  let best = null
  for (const r of [reading(2500, 1), reading(150, 2), reading(300, 3), reading(40, 4), reading(12, 5)]) best = L.pickBestReading(best, r)
  check("sequence ends on the 12 m reading", best.accuracy, 12)
}

// ── Stopping the watch ──────────────────────────────────────────────────────
check("stops at 25 m", L.shouldStopWatching(reading(25), 1000), true)
check("keeps going at 26 m", L.shouldStopWatching(reading(26), 1000), false)
check("keeps going with nothing yet", L.shouldStopWatching(null, 5000), false)
check("stops at 20 s regardless", L.shouldStopWatching(reading(400), 20_000), true)
check("stops at 20 s with nothing", L.shouldStopWatching(null, 20_000), true)
check("thresholds", [L.GPS_GOOD_ENOUGH_M, L.GPS_WATCH_LIMIT_MS, L.NO_GPS_ACCURACY_M], [25, 20000, 1000])

// ── Quality and copy ────────────────────────────────────────────────────────
check("quality precise", L.fixQuality(8), "precise")
check("quality good", L.fixQuality(60), "good")
check("quality rough", L.fixQuality(800), "rough")
check("quality no GPS", L.fixQuality(25000), "no_gps")
check("accuracy 8 m", L.accuracyText(8), "±8 m")
check("accuracy rounds", L.accuracyText(12.4), "±12 m")
check("accuracy under a metre", L.accuracyText(0.4), "±1 m")
check("accuracy 1.2 km", L.accuracyText(1240), "±1.2 km")
check("accuracy 2 km", L.accuracyText(2000), "±2 km")
check("accuracy 25 km", L.accuracyText(25300), "±25 km")
check("accuracy unknown", L.accuracyText(null), "")
check("live line with a reading", L.locatingText(reading(12)), "Finding your exact location… ±12 m")
check("live line before a reading", L.locatingText(null), "Finding your exact location…")
check("no note when precise", L.fixNote(10), null)
check("no-GPS note mentions a phone", /phone/.test(L.fixNote(25000)) && /by hand/.test(L.fixNote(25000)), true)
check("rough note asks to move the map", /Move the map/.test(L.fixNote(500)), true)
check("error codes", [1, 2, 3].map(L.geoErrorReason), ["denied", "unavailable", "timeout"])
check("denied in an in-app browser says open in your browser", /Open JinVa in your browser/.test(L.geoErrorText("denied", true)), true)
check("denied elsewhere points at site settings", /site settings/.test(L.geoErrorText("denied", false)), true)
for (const r of ["denied", "unavailable", "timeout", "unsupported", "insecure"]) {
  check(`${r} lets them place the pin by hand`, /move the map/i.test(L.geoErrorText(r)), true)
}
check("Facebook in-app", L.isInAppBrowser("Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/450.0]"), true)
check("Instagram in-app", L.isInAppBrowser("Mozilla/5.0 (Linux; Android 14) Instagram 300.0"), true)
check("Android WebView", L.isInAppBrowser("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36"), true)
check("Chrome is not in-app", L.isInAppBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36"), false)
check("Safari is not in-app", L.isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"), false)

// ── Ghana bounds ────────────────────────────────────────────────────────────
check("Adum is in Ghana", L.isInGhana(ADUM.latitude, ADUM.longitude), true)
check("Tamale is in Ghana", L.isInGhana(9.4008, -0.8393), true)
check("box corners count", [L.isInGhana(4.5, -3.3), L.isInGhana(11.2, 1.2)], [true, true])
check("Lomé is not", L.isInGhana(6.13, 1.25), false)
check("Abidjan is not", L.isInGhana(5.36, -4.0), false)
check("the sea south of Takoradi is not", L.isInGhana(4.4, -1.75), false)
check("NaN is not", L.isInGhana(NaN, -1), false)
check("the map may centre on a GPS fix", L.canCentreOn(reading(40)), true)
check("never on a network guess", L.canCentreOn(reading(2500)), false)
check("never outside Ghana", L.canCentreOn({ latitude: 6.13, longitude: 1.25, accuracy: 10, timestamp: 1 }), false)

// ── Where the map opens ─────────────────────────────────────────────────────
check("typed Kumasi area", L.centreForAddress("Hse 12, Adum").name, "Kumasi")
check("typed town", L.centreForAddress("Near the market, Tamale").name, "Tamale")
check("first town named wins", L.centreForAddress("Osu, Accra (moving to Kumasi)").name, "Accra")
check("whole words: Hohoe is not Ho", L.centreForAddress("Hohoe").name, "Accra")
check("whole words: Washington is not Wa", L.centreForAddress("Washington").name, "Accra")
check("nothing typed opens on Accra", L.centreForAddress("").name, L.DEFAULT_CENTRE.name)
check("a town opens closer than the default", L.centreForAddress("Kumasi").zoom > L.DEFAULT_CENTRE.zoom, true)

// ── Geometry ────────────────────────────────────────────────────────────────
check("distance 0", L.distanceM(ADUM, ADUM), 0)
{
  const d = L.distanceM(ADUM, { latitude: ADUM.latitude + 0.001, longitude: ADUM.longitude })
  check("0.001° latitude ≈ 111 m", Math.round(d), 111)
}
check("GPS accuracy kept while the pin stays in the circle", L.pinAccuracy({ latitude: ADUM.latitude + 0.00005, longitude: ADUM.longitude }, reading(12)), 12)
check("dropped once the pin is moved out of it", L.pinAccuracy({ latitude: ADUM.latitude + 0.001, longitude: ADUM.longitude }, reading(12)), null)
check("no accuracy without GPS", L.pinAccuracy(ADUM, null), null)
check("no accuracy from a network guess", L.pinAccuracy(ADUM, reading(2500)), null)
{
  const ring = L.circleRing(ADUM.latitude, ADUM.longitude, 50, 32)
  check("circle is closed", JSON.stringify(ring[0]) === JSON.stringify(ring[ring.length - 1]), true)
  check("circle has steps + 1 points", ring.length, 33)
  const r = L.distanceM(ADUM, { latitude: ring[8][1], longitude: ring[8][0] })
  check("circle radius ≈ 50 m", Math.round(r), 50)
}
check("label key rounds to ~100 m (3 decimals)", L.labelKey(6.688512, -1.624456), "6.689,-1.624")
check("coords text", L.coordsText(6.6885, -1.6244), "6.68850° N, 1.62440° W")
check("zoom for accuracy", [L.zoomForAccuracy(10), L.zoomForAccuracy(60), L.zoomForAccuracy(200), L.zoomForAccuracy(900)], [18, 17, 16, 15])
check("arrow keys pan", [L.panStep("ArrowUp"), L.panStep("ArrowRight", true), L.panStep("a")], [[0, -80], [240, 0], null])

// ── Directions ──────────────────────────────────────────────────────────────
check("directions URL", L.directionsUrlFor(6.6885, -1.6244), "https://www.google.com/maps/dir/?api=1&destination=6.6885,-1.6244")
check("directions rounds to 6 decimals", L.directionsUrlFor(6.68851234, -1.62444449), "https://www.google.com/maps/dir/?api=1&destination=6.688512,-1.624444")
check("no directions to 0,0", L.directionsUrlFor(0, 0), null)
check("no directions to NaN", L.directionsUrlFor(NaN, 1), null)
check("job directions prefer the pin", J.directionsUrl({ location: "Adum, Kumasi", latitude: "6.688500", longitude: "-1.624400" }), "https://www.google.com/maps/dir/?api=1&destination=6.6885,-1.6244")
check("job directions fall back to the area", J.directionsUrl({ location: "Adum, Kumasi", latitude: null, longitude: null }), "https://www.google.com/maps/dir/?api=1&destination=Adum%2C%20Kumasi")
check("pointOf strings", L.pointOf({ latitude: "6.688500", longitude: "-1.624400" }), ADUM)
check("pointOf absent (area only)", L.pointOf({ location: "Adum" }), null)
check("pointOf empty strings", L.pointOf({ latitude: "", longitude: "" }), null)

// ── What the forms send ─────────────────────────────────────────────────────
const pin = { ...ADUM, accuracyM: 8.4, label: "Hudgson Street, Adum, Kumasi", area: "Adum, Kumasi", snapshot: null }
check("payload with a GPS pin", L.pinPayload(pin, "  Opposite Adum Post Office,   blue gate "), {
  latitude: 6.6885,
  longitude: -1.6244,
  locationAccuracyM: 8,
  landmark: "Opposite Adum Post Office, blue gate",
})
check("payload with a pin placed by hand", L.pinPayload({ ...pin, accuracyM: null }, ""), { latitude: 6.6885, longitude: -1.6244 })
check("payload with nothing (old behaviour)", L.pinPayload(null, ""), {})
check("payload with only a landmark", L.pinPayload(null, "Blue gate"), { landmark: "Blue gate" })
check("payload never sends a pin outside Ghana", L.pinPayload({ ...pin, latitude: 6.13, longitude: 1.25 }, ""), {})
check("landmark capped at 140", L.pinPayload(null, "x".repeat(200)).landmark.length, 140)
check("summary with GPS", L.pinSummary(pin), "Pinned · ±8 m")
check("summary by hand", L.pinSummary({ ...pin, accuracyM: null }), "Pinned on the map")

if (failures) {
  console.error(`\ntest:location — ${failures} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`test:location — all ${passed} checks passed`)
