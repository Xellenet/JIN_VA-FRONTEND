"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Crosshair, Loader2, Minus, Plus, X } from "lucide-react"
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  accuracyText,
  canCentreOn,
  centreForAddress,
  circleRing,
  coordsText,
  fixNote,
  geoErrorText,
  isInGhana,
  labelKey,
  locatingText,
  panStep,
  pinAccuracy,
  zoomForAccuracy,
  type GpsReading,
  type PinnedLocation,
} from "@/lib/location-pin"
import { loadMapEngine, supportsWebGL, tokenColour } from "./load-map-engine"
import { MapPinGlyph } from "./map-pin-glyph"
import { usePreciseLocation } from "./use-precise-location"

type LabelState =
  | { status: "idle" | "loading" }
  | { status: "ready"; label: string | null; area: string | null }
  | { status: "unavailable" }

interface Point {
  latitude: number
  longitude: number
}

/** Wait this long after the map stops before looking the address up. */
const LABEL_DEBOUNCE_MS = 700
/** Buttons over the map: solid in both themes (the map itself stays light). */
const MAP_BUTTON = "h-11 w-11 bg-background text-foreground shadow-sm dark:bg-background dark:hover:bg-accent"

/** A little beyond Ghana's box, so the borders can be centred. */
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-4.6, 3.6],
  [2.4, 12.2],
]

export interface LocationPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The pin confirmed before, to reopen on. */
  initial: PinnedLocation | null
  /** What the person typed, for where to open without a GPS fix. */
  addressHint?: string
  onConfirm: (pin: PinnedLocation) => void
  /** Where focus goes on close (the button that opened it may be gone by then). */
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * Uber-style exact location picker. The map moves under a fixed centre pin:
 * on a touchscreen the whole map is the drag target, the finger never hides
 * the pin, and arrow keys pan it the same way. It starts precise GPS as it
 * opens, shows the live accuracy and circle, and looks up a readable address
 * for wherever the pin rests.
 */
export function LocationPicker({ open, onOpenChange, initial, addressHint, onConfirm, onCloseAutoFocus }: LocationPickerProps) {
  const statusId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [mapState, setMapState] = useState<"loading" | "ready" | "failed">("loading")
  const [centre, setCentre] = useState<Point | null>(initial)
  const [moving, setMoving] = useState(false)
  const [label, setLabel] = useState<LabelState>({ status: "idle" })
  const labelCache = useRef(new Map<string, { label: string | null; area: string | null }>())
  const labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const labelAbort = useRef<AbortController | null>(null)
  /** Set once the person moves the map, so GPS updates stop pulling it back. */
  const userMoved = useRef(false)
  const { state: gps, start: startGps, stop: stopGps, inAppBrowser } = usePreciseLocation()
  const fix: GpsReading | null = gps.best

  const opening = useMemo(() => {
    if (initial) return { latitude: initial.latitude, longitude: initial.longitude, zoom: zoomForAccuracy(initial.accuracyM), name: "your pin" }
    return centreForAddress(addressHint)
  }, [initial, addressHint])

  // ── Address label (debounced, through the API, rounded to ~100 m) ─────────
  /** Looks the point up now; resolves to the label, or null when unavailable. */
  const resolveLabel = useCallback(async (p: Point): Promise<{ label: string | null; area: string | null } | null> => {
    if (labelTimer.current) clearTimeout(labelTimer.current)
    if (!isInGhana(p.latitude, p.longitude)) {
      setLabel({ status: "ready", label: null, area: null })
      return { label: null, area: null }
    }
    const key = labelKey(p.latitude, p.longitude)
    const cached = labelCache.current.get(key)
    if (cached) {
      setLabel({ status: "ready", ...cached })
      return cached
    }
    labelAbort.current?.abort()
    const ctrl = new AbortController()
    labelAbort.current = ctrl
    setLabel({ status: "loading" })
    const [lat, lon] = key.split(",")
    try {
      const res = await apiFetch<{ label: string | null; area?: string | null; available: boolean }>(
        `/locations/reverse?lat=${lat}&lon=${lon}`,
        { signal: ctrl.signal },
      )
      if (ctrl.signal.aborted) return null
      if (res.available === false) {
        setLabel({ status: "unavailable" })
        return null
      }
      const value = { label: res.label ?? null, area: res.area ?? null }
      labelCache.current.set(key, value)
      setLabel({ status: "ready", ...value })
      return value
    } catch {
      if (!ctrl.signal.aborted) setLabel({ status: "unavailable" })
      return null
    }
  }, [])

  /** The same, once the map has rested for a moment. */
  const lookUp = useCallback(
    (p: Point) => {
      if (labelTimer.current) clearTimeout(labelTimer.current)
      labelTimer.current = setTimeout(() => void resolveLabel(p), LABEL_DEBOUNCE_MS)
    },
    [resolveLabel],
  )

  // ── The map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    let cancelled = false
    let map: MapLibreMap | null = null
    userMoved.current = false
    setMapState("loading")
    setLabel({ status: "idle" })

    const mount = async () => {
      // The dialog's content mounts in a portal; wait a frame for the node.
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const container = containerRef.current
      if (cancelled || !container) return
      if (!supportsWebGL()) {
        setMapState("failed")
        return
      }
      try {
        const { maplibregl, MAP_STYLE_URL } = await loadMapEngine()
        if (cancelled) return
        map = new maplibregl.Map({
          container,
          style: MAP_STYLE_URL,
          center: [opening.longitude, opening.latitude],
          zoom: opening.zoom,
          minZoom: 5,
          maxZoom: 19,
          maxBounds: MAX_BOUNDS,
          attributionControl: { compact: false },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          keyboard: false,
          // Keeps the last frame readable for the preview snapshot.
          canvasContextAttributes: { preserveDrawingBuffer: true },
        })
        map.touchZoomRotate.disableRotation()
        mapRef.current = map
        const canvas = map.getCanvas()
        canvas.setAttribute("tabindex", "-1")
        canvas.setAttribute("aria-hidden", "true")

        const report = () => {
          const c = map!.getCenter()
          setCentre({ latitude: c.lat, longitude: c.lng })
        }
        map.on("movestart", (e) => {
          // Only the person's own gestures count, not our flyTo.
          if ((e as { originalEvent?: unknown }).originalEvent) userMoved.current = true
          setMoving(true)
        })
        map.on("move", report)
        map.on("moveend", () => {
          setMoving(false)
          report()
          const c = map!.getCenter()
          lookUp({ latitude: c.lat, longitude: c.lng })
        })
        map.on("load", () => {
          if (cancelled || !map) return
          const primary = tokenColour("--primary", "rgb(28, 69, 50)")
          map.addSource("accuracy", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
          map.addLayer({ id: "accuracy-fill", type: "fill", source: "accuracy", paint: { "fill-color": primary, "fill-opacity": 0.12 } })
          map.addLayer({ id: "accuracy-line", type: "line", source: "accuracy", paint: { "line-color": primary, "line-width": 1.5, "line-opacity": 0.6 } })
          setMapState("ready")
          report()
          const c = map.getCenter()
          lookUp({ latitude: c.lat, longitude: c.lng })
        })
        map.on("error", (e) => {
          // A failed tile is not fatal; a failed style is.
          if (!map?.isStyleLoaded() && (e as { error?: { status?: number } }).error) setMapState((s) => (s === "ready" ? s : "failed"))
        })
      } catch {
        if (!cancelled) setMapState("failed")
      }
    }
    void mount()
    if (!initial) startGps()

    return () => {
      cancelled = true
      stopGps()
      if (labelTimer.current) clearTimeout(labelTimer.current)
      labelAbort.current?.abort()
      map?.remove()
      mapRef.current = null
    }
    // Opening is what (re)builds the map; later prop changes don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Follow the GPS fix while it improves, until the person moves the map.
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapState !== "ready") return
    const source = map.getSource("accuracy") as GeoJSONSource | undefined
    const shown = canCentreOn(fix) ? fix : null
    source?.setData({
      type: "FeatureCollection",
      features: shown
        ? [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circleRing(shown.latitude, shown.longitude, shown.accuracy)] } }]
        : [],
    })
    if (shown && !userMoved.current) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      map.easeTo({ center: [shown.longitude, shown.latitude], zoom: zoomForAccuracy(shown.accuracy), duration: reduce ? 0 : 600 })
    }
  }, [fix, mapState])

  // Without a map (no WebGL), the GPS fix is the centre.
  useEffect(() => {
    if (mapState === "failed" && fix && canCentreOn(fix)) {
      setCentre({ latitude: fix.latitude, longitude: fix.longitude })
      lookUp(fix)
    }
  }, [mapState, fix, lookUp])

  const locateMe = () => {
    userMoved.current = false
    startGps()
  }

  const zoom = (delta: number) => {
    const map = mapRef.current
    if (!map) return
    userMoved.current = true
    map.zoomTo(map.getZoom() + delta, { duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250 })
  }

  const onMapKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const map = mapRef.current
    if (!map) return
    const step = panStep(e.key, e.shiftKey)
    if (step) {
      e.preventDefault()
      userMoved.current = true
      // Instant, so quick repeated presses add up instead of cancelling each other.
      map.panBy(step, { duration: 0 })
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault()
      zoom(1)
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault()
      zoom(-1)
    }
  }

  const snapshot = (): string | null => {
    const map = mapRef.current
    if (!map) return null
    try {
      const src = map.getCanvas()
      const out = document.createElement("canvas")
      out.width = 480
      out.height = 240
      const ctx = out.getContext("2d")
      if (!ctx || !src.width || !src.height) return null
      // The middle of the map at 2:1, so the pin (drawn over the image) sits on its spot.
      const w = Math.min(src.width, src.height * 2)
      const h = w / 2
      ctx.drawImage(src, (src.width - w) / 2, (src.height - h) / 2, w, h, 0, 0, out.width, out.height)
      return out.toDataURL("image/jpeg", 0.8)
    } catch {
      return null
    }
  }

  const ready = label.status === "ready" ? label : null
  const [confirming, setConfirming] = useState(false)
  const canConfirm = !!centre && isInGhana(centre.latitude, centre.longitude) && !moving && !confirming
  const confirm = async () => {
    if (!centre || !canConfirm) return
    setConfirming(true)
    // Let the tiles at the pin finish drawing (briefly) so the preview isn't blank.
    const map = mapRef.current
    if (map && !map.areTilesLoaded()) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 2500)
        map.once("idle", () => {
          clearTimeout(t)
          resolve()
        })
      })
    }
    const image = snapshot()
    // Confirmed before the address came back: look it up now (cached when known).
    let value = ready ? { label: ready.label, area: ready.area } : null
    if (!value && label.status !== "unavailable") {
      value = await Promise.race([resolveLabel(centre), new Promise<null>((r) => setTimeout(() => r(null), 4000))])
    }
    setConfirming(false)
    onConfirm({
      latitude: centre.latitude,
      longitude: centre.longitude,
      accuracyM: pinAccuracy(centre, fix),
      label: value?.label ?? null,
      area: value?.area ?? null,
      snapshot: image,
    })
    onOpenChange(false)
  }

  // ── Status copy ───────────────────────────────────────────────────────────
  const gpsLine =
    gps.status === "locating"
      ? locatingText(gps.best)
      : gps.status === "done"
        ? (fixNote(gps.best.accuracy) ?? `Located to ${accuracyText(gps.best.accuracy)}.`)
        : gps.status === "error"
          ? geoErrorText(gps.reason, inAppBrowser)
          : null
  const gpsTone = gps.status === "error" || (gps.status === "done" && gps.best.accuracy > 1000) ? "attention" : "muted"

  const addressLine =
    label.status === "loading"
      ? "Looking up the address…"
      : label.status === "unavailable"
        ? "The address lookup isn't responding. You can still use this spot."
        : ready
          ? (ready.label ?? "No address for this spot. Add a landmark so the artisan can find it.")
          : centre && !isInGhana(centre.latitude, centre.longitude)
            ? "Move the pin to a place in Ghana."
            : "Move the map to put the pin on the place."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 motion-reduce:animate-none",
          // Full screen on phones, a large sheet elsewhere.
          "max-sm:top-0 max-sm:left-0 max-sm:h-[100dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0",
          "sm:h-[min(760px,92vh)] sm:max-w-3xl",
        )}
      >
        <div className="flex items-start gap-3 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base sm:text-lg">
              Pin the exact location
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs sm:text-sm">
              Move the map so the pin sits on the place. Only the artisan you hire sees it.
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X aria-hidden className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative min-h-0 flex-1 bg-muted">
          {/* The map. Focusable, so arrow keys can pan it; the pin stays in the centre. */}
          {/* MapLibre's stylesheet makes its container position: relative, so it fills a positioned wrapper. */}
          <div className="absolute inset-0">
            <div
              ref={containerRef}
              role="application"
              aria-roledescription="map"
              aria-label="Map. Use the arrow keys to move the map and plus or minus to zoom. The pin stays in the centre."
              aria-describedby={statusId}
              tabIndex={mapState === "ready" ? 0 : -1}
              onKeyDown={onMapKeyDown}
              className="h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            />
          </div>

          {mapState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
              Loading the map…
            </div>
          )}
          {mapState === "failed" && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
              <p className="max-w-sm">
                The map couldn&apos;t load on this device. Tap Locate me to use your GPS position, then confirm it.
              </p>
            </div>
          )}

          {mapState !== "failed" && (
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
              {/* Shadow dot on the exact spot; the pin's tip sits on it and lifts while the map moves. */}
              <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/40" />
              <MapPinGlyph
                className={cn(
                  "absolute h-11 w-11 -translate-x-1/2 -translate-y-full text-primary drop-shadow-md motion-safe:transition-transform",
                  moving && "motion-safe:-translate-y-[calc(100%+8px)]",
                )}
              />
            </div>
          )}

          {gpsLine && (
            <p
              className={cn(
                "absolute inset-x-3 top-3 mx-auto max-w-md rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm sm:text-sm",
                gpsTone === "attention" ? "border-attention/40 text-foreground" : "text-muted-foreground",
              )}
            >
              {gps.status === "locating" && <Loader2 aria-hidden className="mr-1.5 inline h-3.5 w-3.5 align-[-2px] motion-safe:animate-spin" />}
              {gpsLine}
            </p>
          )}

          <div className="absolute bottom-10 right-3 flex flex-col gap-2">
            {mapState === "ready" && (
              <>
                <Button type="button" variant="outline" size="icon" className={MAP_BUTTON} onClick={() => zoom(1)} aria-label="Zoom in">
                  <Plus aria-hidden className="h-5 w-5" />
                </Button>
                <Button type="button" variant="outline" size="icon" className={MAP_BUTTON} onClick={() => zoom(-1)} aria-label="Zoom out">
                  <Minus aria-hidden className="h-5 w-5" />
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              className={cn(MAP_BUTTON, "w-auto gap-2 px-3")}
              onClick={locateMe}
              disabled={gps.status === "locating"}
            >
              {gps.status === "locating" ? (
                <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <Crosshair aria-hidden className="h-4 w-4" />
              )}
              Locate me
            </Button>
          </div>
        </div>

        <div className="space-y-3 border-t bg-background px-4 py-3 sm:px-5 sm:py-4">
          {/* The text alternative to the map: where the pin is, in words and numbers. */}
          <div id={statusId} aria-live="polite" className="min-w-0">
            <p className="break-words text-sm font-medium text-foreground">{addressLine}</p>
            {centre && (
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                <span className="sr-only">Pin at </span>
                {coordsText(centre.latitude, centre.longitude)}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 bg-transparent" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" className="h-11" onClick={() => void confirm()} disabled={!canConfirm}>
              {confirming && <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />}
              Use this location
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LocationPicker
