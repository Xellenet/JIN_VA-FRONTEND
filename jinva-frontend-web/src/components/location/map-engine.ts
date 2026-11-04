/**
 * MapLibre GL, loaded only when a map is shown (see `loadMapEngine`), so no
 * other page pays for it. Importing this module is what pulls the library,
 * its stylesheet and its worker into their own chunks.
 *
 * Tiles: OpenFreeMap (free, no key, OpenStreetMap data). The map's own
 * attribution control shows "© OpenStreetMap contributors" as the licence
 * requires. CSP: see `src/lib/csp.ts` (connect-src for the tiles origin; the
 * worker is served from this origin).
 */
import * as maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

// MapLibre 6 starts its worker from a URL next to its own module, which a
// bundler moves. Hand it the bundled copy (same origin, so `worker-src 'self'`).
maplibregl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href)

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty"

export { maplibregl }
