"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import { getNotificationTypeConfig } from "@/lib/status-badges"
import {
  mapNotification,
  readNotificationList,
  type BackendNotification,
  type UnreadCountResponse,
} from "@/lib/notifications"
import type { Notification } from "@/lib/types"
import { HeaderIconBadge, POPOVER_POLL_MS, PREVIEW_ROW_LIMIT } from "./header-badge"

/**
 * HB1 / design-spec.md section 3 — the Bell icon's real unread badge and
 * preview dropdown.
 *
 * Replaces a hardcoded, always-on dot and a plain Link-to-page with:
 *   - a numeric badge driven by `GET /notifications/unread-count` (already
 *     implemented backend-side, never called by the frontend before now),
 *     rendering nothing at all at zero;
 *   - a Popover preview of the 5 most recent notifications, with "Mark all
 *     read" and a "View all notifications" footer link to the existing page.
 *
 * Clicking a row marks it read in place and keeps the popover open — a peek,
 * not a navigation. Full detail stays on the Notifications page's Dialog.
 */
export function NotificationsPopover({ roleBase }: Readonly<{ roleBase: string }>) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  // ── Badge count — fetched on mount and polled, so the badge is accurate
  //    before the dropdown is ever opened and clears itself after a read.
  const loadUnreadCount = useCallback(async () => {
    try {
      const r = await apiFetch<UnreadCountResponse>("/notifications/unread-count")
      setUnreadCount(typeof r?.count === "number" ? r.count : 0)
    } catch {
      // A failed count shows no badge at all rather than a stale or fake one
      // (copy guidelines: "a badge that's always on is worse than no badge").
      setUnreadCount(0)
    }
  }, [])

  useEffect(() => {
    loadUnreadCount()
    const id = setInterval(loadUnreadCount, POPOVER_POLL_MS)
    const onFocus = () => loadUnreadCount()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [loadUnreadCount])

  // ── Preview rows — fetched lazily when the popover opens.
  const loadItems = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)
    try {
      const r = await apiFetch<BackendNotification[] | { items: BackendNotification[] }>(
        `/notifications?page=1&limit=${PREVIEW_ROW_LIMIT}`,
      )
      setItems(readNotificationList(r).slice(0, PREVIEW_ROW_LIMIT).map(mapNotification))
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadItems()
  }, [open, loadItems])

  const markRead = async (id: string) => {
    const target = items.find((n) => n.id === id)
    if (!target || target.isRead) return
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" })
    } catch {
      // Optimistic update stands; the next poll reconciles the real count.
    }
  }

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" })
    } catch {
      // Same as above — reconciled by the next poll.
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications">
          <Bell className="h-[1.1rem] w-[1.1rem] text-muted-foreground" />
          <HeaderIconBadge count={unreadCount} />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {items.some((n) => !n.isRead) && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-1 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-1 py-2">
                  <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-2.5 w-2/3" />
                    <Skeleton className="h-2.5 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : hasError ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-xs font-semibold text-foreground">Couldn&apos;t load notifications</p>
              <button
                type="button"
                onClick={loadItems}
                className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
              >
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Bell className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <p className="text-xs font-semibold text-foreground">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">Nothing new right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((n) => {
                const config = getNotificationTypeConfig(n.type)
                const Icon = config.icon
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markRead(n.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50",
                      !n.isRead && "bg-accent/50",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                        config.bg,
                      )}
                    >
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-xs text-foreground",
                            n.isRead ? "font-medium" : "font-semibold",
                          )}
                        >
                          {n.title}
                        </span>
                        <span className="flex-shrink-0 text-[10px] text-muted-foreground">{n.time}</span>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 line-clamp-1 text-[11px]",
                          n.isRead ? "text-muted-foreground" : "font-medium text-foreground/80",
                        )}
                      >
                        {n.message}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs font-medium" asChild>
            <Link href={`${roleBase}/notifications`} onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
