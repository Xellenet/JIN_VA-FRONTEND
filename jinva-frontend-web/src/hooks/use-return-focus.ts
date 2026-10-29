"use client"

import { useRef } from "react"

/**
 * QA UI-08: Radix returns focus to a dialog's `<Trigger>` on close, but most
 * dialogs here are opened from state with no trigger, so focus fell to the
 * page instead of the button that opened them. This remembers what had focus
 * as the dialog opens (`onOpenAutoFocus` runs before focus moves inside) and
 * puts it back on close, unless the caller handled focus itself or that
 * element is gone.
 */
export function useReturnFocus(
  onOpenAutoFocus?: (event: Event) => void,
  onCloseAutoFocus?: (event: Event) => void,
) {
  const opener = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (event: Event) => {
      opener.current = document.activeElement as HTMLElement | null
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      const el = opener.current
      opener.current = null
      if (event.defaultPrevented) return
      if (el && el !== document.body && document.contains(el)) {
        event.preventDefault()
        el.focus()
      }
    },
  }
}
