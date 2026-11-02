"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const GUARD_KEY = "__jinvaUnsavedGuard"

/**
 * FR-5.10: "Discard changes?" before leaving unsaved payment preferences, for
 * every way out of the tab:
 *
 * - **Tabs**: the page calls `confirmLeave(proceed)` from its tab handler.
 * - **Links** (sidebar, header menus, "Go to Spending"): a capture-phase click
 *   listener stops same-origin navigation and asks first.
 * - **Browser back**: while dirty, one extra history entry sits on top of the
 *   page. Back pops it; we ask, re-arm it, and "Discard" goes back two.
 * - **Reload or closing the tab**: the browser's own `beforeunload` prompt.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter()
  const [pending, setPending] = useState<(() => void) | null>(null)
  const dirtyRef = useRef(dirty)
  const armedRef = useRef(false)
  dirtyRef.current = dirty

  const confirmLeave = useCallback((proceed: () => void) => {
    if (!dirtyRef.current) {
      proceed()
      return
    }
    setPending(() => proceed)
  }, [])

  // Back button guard entry: added while dirty, and taken off again when the
  // changes are saved or cancelled in place, so Back needs one press.
  useEffect(() => {
    if (dirty && !armedRef.current) {
      window.history.pushState({ ...(window.history.state ?? {}), [GUARD_KEY]: true }, "", window.location.href)
      armedRef.current = true
    } else if (!dirty && armedRef.current) {
      armedRef.current = false
      if (window.history.state?.[GUARD_KEY]) window.history.back()
    }
  }, [dirty])

  useEffect(() => {
    const onPopState = () => {
      if (!armedRef.current) return
      armedRef.current = false
      if (!dirtyRef.current) return
      // Stay on the page (re-arm), then ask.
      window.history.pushState({ ...(window.history.state ?? {}), [GUARD_KEY]: true }, "", window.location.href)
      armedRef.current = true
      setPending(() => () => window.history.go(-2))
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // Links anywhere on the page.
  useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      e.preventDefault()
      e.stopPropagation()
      const target = `${url.pathname}${url.search}${url.hash}`
      setPending(() => () => router.push(target))
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    document.addEventListener("click", onClick, true)
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [dirty, router])

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>Your new payment preferences haven&apos;t been saved.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Radix focuses Cancel first: the safe action (FR-5.10). */}
          <AlertDialogCancel className="max-sm:h-11">Keep editing</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90 max-sm:h-11"
            onClick={() => {
              const go = pending
              setPending(null)
              dirtyRef.current = false
              // Leaving: the guard entry is spent, never popped later.
              armedRef.current = false
              go?.()
            }}
          >
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirmLeave, dialog }
}
