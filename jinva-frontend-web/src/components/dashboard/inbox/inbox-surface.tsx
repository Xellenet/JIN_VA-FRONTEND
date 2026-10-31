"use client"

import { useEffect, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

/** Settings & inbox spec §5.1: popover from 640px, bottom sheet below it. */
const SHEET_QUERY = "(max-width: 639.98px)"

function useIsSheet(): boolean {
  const [isSheet, setIsSheet] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(SHEET_QUERY)
    const sync = () => setIsSheet(mql.matches)
    sync()
    mql.addEventListener("change", sync)
    return () => mql.removeEventListener("change", sync)
  }, [])
  return isSheet
}

interface InboxSurfaceProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** The header icon button. Rendered as the trigger of whichever surface is live. */
  readonly trigger: ReactNode
  /** Accessible name of the menu ("Notifications", "Messages"). */
  readonly label: string
  /** Title row content: heading, unread count, "Mark all read". */
  readonly heading: ReactNode
  /** Extra title-row controls on desktop (e.g. "Mark all read"). */
  readonly headingAction?: ReactNode
  readonly children: ReactNode
  readonly footer: ReactNode
  /**
   * First Escape collapses the open item (FR-6.4). Return true when an item was
   * collapsed, so the menu stays open and focus stays on the item header.
   */
  readonly onEscape: () => boolean
}

/**
 * The bell and envelope menus' shell (item 6): a 400px popover at ≥ 640px
 * and a bottom sheet below it, with the same list inside. Escape is two-step:
 * the first press collapses the open item, the second closes the menu and
 * Radix/vaul return focus to the icon button.
 */
export function InboxSurface({
  open,
  onOpenChange,
  trigger,
  label,
  heading,
  headingAction,
  children,
  footer,
  onEscape,
}: InboxSurfaceProps) {
  const isSheet = useIsSheet()

  const handleEscape = (e: KeyboardEvent) => {
    if (onEscape()) e.preventDefault()
  }

  if (isSheet) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent
          aria-label={label}
          onEscapeKeyDown={handleEscape}
          className="max-h-[85vh] data-[vaul-drawer-direction=bottom]:max-h-[85vh] bg-popover"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
              <DrawerTitle asChild>
                <div className="flex min-w-0 items-baseline gap-2">{heading}</div>
              </DrawerTitle>
              <DrawerDescription className="sr-only">{`Your latest ${label.toLowerCase()}`}</DrawerDescription>
              <div className="flex items-center gap-1">
                {headingAction}
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                  className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            <div className="border-t pb-[env(safe-area-inset-bottom)]">{footer}</div>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={label}
        role="dialog"
        onEscapeKeyDown={handleEscape}
        className={cn(
          "flex w-[400px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl p-0",
          "max-h-[var(--radix-popover-content-available-height)]",
          "shadow-[0_12px_40px_-12px_rgb(0_0_0/0.25),0_2px_6px_-2px_rgb(0_0_0/0.08)]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-2">{heading}</div>
          {headingAction && <div className="flex items-center gap-1">{headingAction}</div>}
        </div>
        <div className="max-h-[70vh] min-h-0 overflow-y-auto overscroll-contain">{children}</div>
        <div className="shrink-0 border-t">{footer}</div>
      </PopoverContent>
    </Popover>
  )
}
