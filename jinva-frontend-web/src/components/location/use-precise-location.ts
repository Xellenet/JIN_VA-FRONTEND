"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  GPS_WATCH_LIMIT_MS,
  geoErrorReason,
  isInAppBrowser,
  pickBestReading,
  shouldStopWatching,
  type GeoErrorReason,
  type GpsReading,
} from "@/lib/location-pin"

export type PreciseLocationState =
  | { status: "idle"; best: null }
  | { status: "locating"; best: GpsReading | null }
  | { status: "done"; best: GpsReading }
  | { status: "error"; best: null; reason: GeoErrorReason }

/**
 * Precise GPS, the way ride-hailing apps do it: `watchPosition` with high
 * accuracy and no cached fix, keeping the best reading, until one is within
 * 25 m or 20 s have passed. Readings are kept in memory only; nothing is
 * logged or stored.
 */
export function usePreciseLocation() {
  const [state, setState] = useState<PreciseLocationState>({ status: "idle", best: null })
  const watchId = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const best = useRef<GpsReading | null>(null)
  const startedAt = useRef(0)

  const clear = useCallback(() => {
    if (watchId.current != null && typeof navigator !== "undefined") navigator.geolocation?.clearWatch(watchId.current)
    watchId.current = null
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const finish = useCallback(
    (reason?: GeoErrorReason) => {
      clear()
      const b = best.current
      if (b) setState({ status: "done", best: b })
      else setState({ status: "error", best: null, reason: reason ?? "timeout" })
    },
    [clear],
  )

  const start = useCallback(() => {
    clear()
    best.current = null
    if (typeof window === "undefined") return
    if (!window.isSecureContext) {
      setState({ status: "error", best: null, reason: "insecure" })
      return
    }
    if (!("geolocation" in navigator) || !navigator.geolocation) {
      setState({ status: "error", best: null, reason: "unsupported" })
      return
    }
    startedAt.current = Date.now()
    setState({ status: "locating", best: null })
    timer.current = setTimeout(() => finish("timeout"), GPS_WATCH_LIMIT_MS)
    try {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const next = pickBestReading(best.current, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp || Date.now(),
          })
          if (!next) return
          best.current = next
          if (shouldStopWatching(next, Date.now() - startedAt.current)) finish()
          else setState({ status: "locating", best: next })
        },
        (err) => {
          const reason = geoErrorReason(err.code)
          // A reading already in hand is better than an error: keep it.
          if (reason === "denied" || !best.current) {
            best.current = reason === "denied" ? null : best.current
            finish(reason)
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_WATCH_LIMIT_MS },
      )
    } catch {
      setState({ status: "error", best: null, reason: "unsupported" })
      clear()
    }
  }, [clear, finish])

  const stop = useCallback(() => {
    clear()
    setState((s) => (s.status === "locating" ? (s.best ? { status: "done", best: s.best } : { status: "idle", best: null }) : s))
  }, [clear])

  useEffect(() => clear, [clear])

  const inAppBrowser = typeof navigator !== "undefined" && isInAppBrowser(navigator.userAgent)

  return { state, start, stop, inAppBrowser }
}
