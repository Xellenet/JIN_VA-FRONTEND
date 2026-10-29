"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import {
  getPermissionState,
  isPushConfigured,
  isPushSupported,
  listenForForegroundPush,
  registerPushToken,
} from "@/lib/push-notifications"

/**
 * PN1 — keeps this browser's FCM token registered for the signed-in user.
 *
 * Runs once per page load, inside the dashboard shell (so it only ever runs for
 * an authenticated user). It deliberately does NOT prompt for permission:
 * throwing a browser permission dialog at someone who just opened a dashboard
 * is the classic way to get permanently denied. The prompt lives on the "Push
 * Notifications" channel toggle in Settings, where the user asked for it.
 *
 * What this does do:
 *   - re-registers the token when permission is already granted, so it follows
 *     the newly signed-in account on a shared device and survives FCM's
 *     periodic token rotation;
 *   - shows foreground pushes as toasts, since FCM suppresses system
 *     notifications while the tab is focused.
 */
let hasSyncedThisPageLoad = false

export function PushSync() {
  useEffect(() => {
    if (!isPushSupported() || !isPushConfigured()) return
    if (getPermissionState() !== "granted") return

    let unsubscribe: (() => void) | null = null
    let cancelled = false

    const run = async () => {
      if (!hasSyncedThisPageLoad) {
        hasSyncedThisPageLoad = true
        // promptIfNeeded=false — permission is already granted, and this must
        // stay silent either way.
        await registerPushToken(false)
      }
      if (cancelled) return
      unsubscribe = await listenForForegroundPush((title, body) => {
        toast(title, body ? { description: body } : undefined)
      })
    }

    run()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return null
}
