"use client"

import { useCallback, useEffect, useState } from "react"
import { resendAvailableAtMs, secondsUntil } from "@/lib/auth-code"

/**
 * Auth v2: the "Resend in 0:42" timer, counted down to the API's
 * `resendAvailableAt` (the server's cooldown, so the button never offers a
 * resend the backend would refuse with a 429).
 *
 * The remaining time is recomputed from the wall clock on each tick rather
 * than decremented, so a backgrounded tab (where timers are throttled) shows
 * the right number the moment it is visible again.
 */
export function useResendCountdown(initial?: string | null) {
  const [availableAt, setAvailableAt] = useState<number | null>(() =>
    initial === undefined ? null : resendAvailableAtMs(initial, Date.now()),
  )
  const [now, setNow] = useState(() => Date.now())

  const remaining = secondsUntil(availableAt, now)

  useEffect(() => {
    if (availableAt === null || remaining <= 0) return
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, 1000)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [availableAt, remaining])

  /** Start (or restart) from a `resendAvailableAt` value, or from a number of seconds. */
  const start = useCallback((value: string | number | null | undefined) => {
    const t = Date.now()
    setNow(t)
    setAvailableAt(typeof value === "number" && value < 1e9 ? t + value * 1000 : resendAvailableAtMs(value, t))
  }, [])

  return { remaining, canResend: remaining === 0, start }
}
