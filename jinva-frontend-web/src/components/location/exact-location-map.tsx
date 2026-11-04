"use client"

import { useEffect, useRef, useState } from "react"
import { Navigation } from "lucide-react"
import type { Map as MapLibreMap } from "maplibre-gl"
import { accuracyText, coordsText, directionsUrlFor } from "@/lib/location-pin"
import { cn } from "@/lib/utils"
import { loadMapEngine, supportsWebGL } from "./load-map-engine"
import { MapPinGlyph } from "./map-pin-glyph"

export interface ExactLocationMapProps {
  latitude: number
  longitude: number
  landmark?: string | null
  accuracyM?: number | null
  /** The area label, read out with the map. */
  area?: string | null
  /** Off where the page already shows its own "Get directions". */
  showDirections?: boolean
  className?: string
}

/**
 * The hired artisan's view of the customer's pin: a small still map (the
 * library loads only when this mounts), the landmark and "Get directions".
 */
export function ExactLocationMap({ latitude, longitude, landmark, accuracyM, area, showDirections = true, className }: ExactLocationMapProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")
  const directions = directionsUrlFor(latitude, longitude)

  useEffect(() => {
    let cancelled = false
    let map: MapLibreMap | null = null
    const container = ref.current
    if (!container) return
    if (!supportsWebGL()) {
      setState("failed")
      return
    }
    loadMapEngine()
      .then(({ maplibregl, MAP_STYLE_URL }) => {
        if (cancelled) return
        map = new maplibregl.Map({
          container,
          style: MAP_STYLE_URL,
          center: [longitude, latitude],
          zoom: 16,
          interactive: false,
          attributionControl: { compact: false },
        })
        map.getCanvas().setAttribute("aria-hidden", "true")
        map.on("load", () => !cancelled && setState("ready"))
        map.on("error", () => !cancelled && !map?.isStyleLoaded() && setState("failed"))
      })
      .catch(() => !cancelled && setState("failed"))
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [latitude, longitude])

  return (
    <div className={cn("space-y-2", className)}>
      <figure className="relative h-44 overflow-hidden rounded-lg border bg-muted sm:h-52">
        <div className="absolute inset-0">
          <div ref={ref} className="h-full w-full" />
        </div>
        {state !== "failed" && (
          <MapPinGlyph className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-full text-primary drop-shadow-md" />
        )}
        {state === "failed" && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
            The map couldn&apos;t load here. Get directions opens it in your map app.
          </p>
        )}
        <figcaption className="sr-only">
          Map of the exact location{area ? ` in ${area}` : ""}: {coordsText(latitude, longitude)}
          {accuracyM != null ? `, accurate to ${accuracyText(accuracyM)}` : ""}.
        </figcaption>
      </figure>
      {landmark && (
        <p className="break-words text-sm text-foreground">
          <span className="text-muted-foreground">Landmark: </span>
          {landmark}
        </p>
      )}
      {showDirections && directions && (
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Navigation aria-hidden className="h-4 w-4" />
          Get directions
          <span className="sr-only"> (opens Google Maps in a new tab)</span>
        </a>
      )}
    </div>
  )
}

export default ExactLocationMap
