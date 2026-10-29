"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { consumeFlashToast } from "@/lib/flash"

/**
 * Pops the pending flash message (see lib/flash.ts) once, on the first render
 * after a hard navigation. Renders nothing.
 *
 * MUST stay mounted *after* `<Toaster />` in the root layout. Sonner's store
 * only notifies subscribers that already exist when a toast is created, and
 * React runs sibling effects in tree order — so a `toast()` call from anywhere
 * inside `{children}` fires before `<Toaster />` has subscribed and is silently
 * dropped. Sitting below it in the same layout is what guarantees the
 * subscription is live by the time this effect runs.
 */
export function FlashToast() {
  useEffect(() => {
    const message = consumeFlashToast()
    if (message) toast.success(message)
  }, [])

  return null
}
