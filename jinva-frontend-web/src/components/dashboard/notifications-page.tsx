"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react"
import type { Notification } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch, apiFetchWithMeta } from "@/lib/api"
import { getNotificationTypeConfig } from "@/lib/status-badges"
import {
  formatFullDateTime,
  mapNotification,
  notificationAction,
  readNotificationList,
  type BackendNotification,
  type NotificationRole,
  type UnreadCountResponse,
} from "@/lib/notifications"

/**
 * NR4 — real pagination instead of a hardcoded `limit=50` with nothing beyond
 * it reachable. Same "Load more" + `meta.pagination` idiom the reviews lists
 * already use (see `artisan/reviews/page.tsx`).
 */
const PAGE_SIZE = 20

/**
 * NR2 — the feed refreshes on a cadence and on window focus, so a notification
 * that arrives while the page is open shows up without a manual reload. Matched
 * to the header bell's own poll (`header-badge.ts`'s `POPOVER_POLL_MS`) so the
 * badge above and the list beneath it can't contradict each other.
 */
const FEED_POLL_MS = 30_000

function extractTotalPages(meta: Record<string, unknown> | undefined): number {
  const direct = meta?.totalPages as number | undefined
  const nested = (meta?.pagination as { totalPages?: number } | undefined)?.totalPages
  const value = direct ?? nested ?? 1
  return value > 0 ? value : 1
}

/**
 * H5: the number of notifications the server has, not the number loaded.
 * `meta.pagination.total` (notifications.service `findAll`), tolerating the
 * `totalItems` spelling the shared response DTO documents. Null when absent.
 */
function extractTotal(meta: Record<string, unknown> | undefined): number | null {
  const p = meta?.pagination as { total?: unknown; totalItems?: unknown } | undefined
  const value = p?.total ?? p?.totalItems ?? meta?.total
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

function fetchPage(
  page: number,
  unreadOnly = false,
): Promise<{ items: Notification[]; totalPages: number; total: number | null }> {
  return apiFetchWithMeta<BackendNotification[] | { items: BackendNotification[] }>(
    `/notifications?page=${page}&limit=${PAGE_SIZE}${unreadOnly ? "&isRead=false" : ""}`,
  ).then(({ data, meta }) => ({
    items: readNotificationList(data).map(mapNotification),
    totalPages: extractTotalPages(meta),
    total: extractTotal(meta),
  }))
}

export function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)

  /**
   * Ids read in this session. A refresh that was already in flight when the
   * user marked something read would otherwise flip it back to unread.
   */
  const locallyRead = useRef<Set<string>>(new Set())
  /** How many pages are currently on screen, so a refresh re-fetches all of them. */
  const loadedPages = useRef(1)
  /**
   * QA NOT-03: the Unread filter asks the server (`isRead=false`) and the
   * count comes from `/notifications/unread-count`. Both used to look only at
   * the pages already loaded, so older unread items read as "all caught up".
   */
  const unreadOnly = useRef(false)
  const [unreadTotal, setUnreadTotal] = useState<number | null>(null)
  /** H5: "All (n)" is the server's total, kept from the last unfiltered fetch. */
  const [allTotal, setAllTotal] = useState<number | null>(null)
  const refreshUnreadTotal = useCallback(() => {
    apiFetch<UnreadCountResponse>("/notifications/unread-count")
      .then((r) => setUnreadTotal(typeof r?.count === "number" ? r.count : null))
      .catch(() => {})
  }, [])

  const applyLocalReads = useCallback(
    (items: Notification[]) =>
      items.map((n) => (locallyRead.current.has(n.id) ? { ...n, isRead: true } : n)),
    [],
  )

  // NR2 — refresh every loaded page so "load more" state survives a poll.
  const refresh = useCallback(async () => {
    try {
      refreshUnreadTotal()
      const pages = await Promise.all(
        Array.from({ length: loadedPages.current }, (_, i) => fetchPage(i + 1, unreadOnly.current)),
      )
      setNotifications(applyLocalReads(pages.flatMap((p) => p.items)))
      setTotalPages(pages[pages.length - 1]?.totalPages ?? 1)
      if (!unreadOnly.current && pages[0]?.total != null) setAllTotal(pages[0].total)
    } catch {
      // Keep what's on screen rather than blanking the feed on a transient error.
    }
  }, [applyLocalReads, refreshUnreadTotal])

  useEffect(() => {
    refresh().finally(() => setIsLoading(false))
    const id = setInterval(refresh, FEED_POLL_MS)
    const onFocus = () => refresh()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])

  const loadMore = async () => {
    setIsLoadingMore(true)
    try {
      const next = page + 1
      const { items, totalPages: pagesTotal, total } = await fetchPage(next, unreadOnly.current)
      setNotifications((prev) => [...prev, ...applyLocalReads(items)])
      setPage(next)
      setTotalPages(pagesTotal)
      if (!unreadOnly.current && total != null) setAllTotal(total)
      loadedPages.current = next
    } catch {
      // Nothing appended; the button stays available for another try.
    } finally {
      setIsLoadingMore(false)
    }
  }

  if (!user) return null

  const unreadCount = unreadTotal ?? notifications.filter((n) => !n.isRead).length
  const allCount = allTotal ?? (filter === "all" ? notifications.length : null)
  const actionRole: NotificationRole | null =
    user.role === "artisan" ? "artisan" : user.role === "user" ? "user" : null
  const displayed = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications

  const changeFilter = (next: "all" | "unread") => {
    if (next === filter) return
    setFilter(next)
    unreadOnly.current = next === "unread"
    loadedPages.current = 1
    setPage(1)
    setIsLoading(true)
    refresh().finally(() => setIsLoading(false))
  }

  const markAllRead = async () => {
    notifications.forEach((n) => locallyRead.current.add(n.id))
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadTotal(0)
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" })
    } catch {
      // optimistic update already applied
    }
  }

  const markRead = async (id: string) => {
    locallyRead.current.add(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadTotal((c) => (c == null ? c : Math.max(c - 1, 0)))
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" })
    } catch {
      // optimistic update already applied
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) markRead(notification.id)
    setSelectedNotification(notification)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "You're all caught up"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Show" className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                aria-pressed={filter === "all"}
                onClick={() => changeFilter("all")}
                className={cn(
                  "h-11 sm:h-9",
                  filter === "all" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-transparent",
                )}
              >
                {allCount == null ? "All" : `All (${allCount})`}
              </Button>
              <Button
                variant={filter === "unread" ? "default" : "outline"}
                size="sm"
                aria-pressed={filter === "unread"}
                onClick={() => changeFilter("unread")}
                className={cn(
                  "h-11 sm:h-9",
                  filter === "unread" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-transparent",
                )}
              >
                Unread ({unreadCount})
              </Button>
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-11 text-primary hover:text-primary/80 sm:h-9">
                <CheckCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Bell className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">
                  {filter === "unread" ? "No unread notifications" : "No notifications"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filter === "unread"
                    ? "All caught up. Switch to All to see past notifications."
                    : "Notifications about your activity will appear here."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {displayed.map((notification) => {
                  const config = getNotificationTypeConfig(notification.type)
                  const Icon = config.icon
                  return (
                    // A row is clickable *and* contains its own "mark read"
                    // button. A <button> inside a <button> is invalid HTML and
                    // React reports it as a hydration error, so the row is a
                    // focusable role="button" element instead — same keyboard
                    // affordance, valid nesting.
                    <div
                      key={notification.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleNotificationClick(notification)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleNotificationClick(notification)
                        }
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left sm:gap-4 sm:px-6 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        !notification.isRead && "bg-accent/50",
                      )}
                    >
                      <div
                        className={cn("mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full", config.bg)}
                        aria-hidden="true"
                      >
                        <Icon className={cn("h-5 w-5", config.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={cn("text-sm font-medium text-foreground", !notification.isRead && "font-semibold")}>
                              {notification.title}
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
                          </div>
                          {!notification.isRead && (
                            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary">
                              <span className="sr-only">Unread</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <time
                            dateTime={notification.createdAt}
                            title={formatFullDateTime(notification.createdAt) || undefined}
                            className="text-xs text-muted-foreground"
                          >
                            {notification.time}
                          </time>
                          <Badge variant="outline" className="text-[11px]">
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Mark "${notification.title}" as read`}
                            className="-my-1.5 -mr-2 h-11 w-11 text-muted-foreground hover:text-foreground sm:h-9 sm:w-9"
                            onClick={(e) => {
                              e.stopPropagation()
                              markRead(notification.id)
                            }}
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* NR4 — anything past the first page is reachable rather than lost. */}
        {!isLoading && page < totalPages && (
          <div className="flex justify-center">
            <Button variant="outline" className="h-11 bg-transparent sm:h-9" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load more notifications
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedNotification && (() => {
            const config = getNotificationTypeConfig(selectedNotification.type)
            const Icon = config.icon
            const fullDate = formatFullDateTime(selectedNotification.createdAt)
            // H5: the same typed-id action the bell menu shows, for this role.
            const action = actionRole
              ? notificationAction(selectedNotification.rawType ?? "", selectedNotification.payload, actionRole)
              : null
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full", config.bg)}
                      aria-hidden="true"
                    >
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <div>
                      <DialogTitle className="text-left">{selectedNotification.title}</DialogTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[11px]">{config.label}</Badge>
                        <time dateTime={selectedNotification.createdAt} className="text-xs text-muted-foreground">
                          {fullDate || selectedNotification.time}
                        </time>
                      </div>
                    </div>
                  </div>
                </DialogHeader>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm leading-relaxed text-foreground">{selectedNotification.message}</p>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="h-11 bg-transparent sm:h-9"
                    onClick={() => setSelectedNotification(null)}
                  >
                    Close
                  </Button>
                  {action && (
                    <Button className="h-11 sm:h-9" asChild>
                      <Link href={action.href} onClick={() => setSelectedNotification(null)}>
                        {action.label}
                      </Link>
                    </Button>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
