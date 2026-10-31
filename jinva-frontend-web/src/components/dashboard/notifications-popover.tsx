"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"
import { markNotificationRead } from "@/lib/customer-api"
import { cn } from "@/lib/utils"
import { getNotificationTypeConfig } from "@/lib/status-badges"
import {
  formatFullDateTime,
  isMessageExcerpt,
  mapNotification,
  notificationAction,
  readNotificationList,
  type BackendNotification,
  type UnreadCountResponse,
} from "@/lib/notifications"
import type { Notification } from "@/lib/types"
import { HeaderIconBadge, POPOVER_POLL_MS, PREVIEW_ROW_LIMIT } from "./header-badge"
import { InboxSurface } from "./inbox/inbox-surface"
import { DisclosureItem, FullText } from "./inbox/disclosure-item"

/** FR-6.10: an item has to stay open this long before it counts as read. */
const READ_AFTER_MS = 1000

/**
 * The Bell icon's unread badge and menu (HB1), now with read in place
 * (item 6): each row is a disclosure that shows the full body, the full date
 * and one action built from typed ids only (`notificationAction`, SEC-18).
 *
 * - One item open at a time; closing the menu collapses everything (FR-6.7).
 * - An unread item is marked read after 1 s open, once per item per menu
 *   opening; the badge drops at once and a failed call quietly reverts.
 * - The list is fetched when the menu opens and is not refreshed while it is
 *   open, so nothing moves under the reader (FR-6.19). The badge keeps polling.
 */
export function NotificationsPopover({ roleBase }: Readonly<{ roleBase: string }>) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const attemptedRef = useRef(new Set<string>())
  const headerRefs = useRef(new Map<string, HTMLButtonElement>())
  // Actions point at customer routes (SEC-18: `/dashboard/user/` only), so
  // other roles read in place without an action button.
  const showActions = roleBase === "/dashboard/user"

  // ── Badge count: fetched on mount and polled.
  const loadUnreadCount = useCallback(async () => {
    try {
      const r = await apiFetch<UnreadCountResponse>("/notifications/unread-count")
      setUnreadCount(typeof r?.count === "number" ? r.count : 0)
    } catch {
      // A failed count shows no badge rather than a stale or fake one.
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

  // ── Rows: fetched when the menu opens.
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

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      loadItems()
    } else {
      // FR-6.7 / SEC-33: nothing stays expanded for the next glance.
      setOpenId(null)
      attemptedRef.current = new Set()
      setAnnouncement("")
    }
  }

  // ── FR-6.10: read after 1 s open.
  useEffect(() => {
    if (!openId) return
    const target = items.find((n) => n.id === openId)
    if (!target || target.isRead || attemptedRef.current.has(openId)) return
    const id = openId
    const timer = setTimeout(async () => {
      attemptedRef.current.add(id)
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
      setAnnouncement("Marked as read")
      try {
        await markNotificationRead(id)
      } catch {
        // Quietly back to unread; no toast (FR-6.10).
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)))
        setUnreadCount((c) => c + 1)
        setAnnouncement("")
      }
    }, READ_AFTER_MS)
    return () => clearTimeout(timer)
  }, [openId, items])

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" })
    } catch {
      // Reconciled by the next poll.
    }
  }

  const collapseOpenItem = () => {
    if (!openId) return false
    const header = headerRefs.current.get(openId)
    setOpenId(null)
    header?.focus()
    return true
  }

  const unreadInList = items.filter((n) => !n.isRead).length
  const unreadShown = Math.max(unreadCount, unreadInList)

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      <Bell className="h-[1.1rem] w-[1.1rem] text-muted-foreground" />
      <HeaderIconBadge count={unreadCount} />
    </Button>
  )

  return (
    <>
      <InboxSurface
        open={open}
        onOpenChange={handleOpenChange}
        trigger={trigger}
        label="Notifications"
        onEscape={collapseOpenItem}
        heading={
          <>
            <h2 className="text-sm font-semibold text-foreground max-sm:text-base">Notifications</h2>
            {unreadShown > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">{unreadShown} unread</span>
            )}
          </>
        }
        headingAction={
          unreadInList > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="h-7 rounded-md px-2 text-xs font-medium text-primary outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary max-sm:h-11 dark:focus-visible:ring-ring"
            >
              Mark all read
            </button>
          ) : null
        }
        footer={
          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[13px] font-medium max-sm:h-11"
              asChild
            >
              <Link href={`${roleBase}/notifications`} onClick={() => handleOpenChange(false)}>
                View all notifications
              </Link>
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <div className="space-y-1 p-3" aria-busy="true" aria-label="Loading notifications">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-1 py-2">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-2.5 w-2/3" />
                  <Skeleton className="h-2.5 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center gap-1 px-6 py-8 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">Couldn&apos;t load notifications</p>
            <p className="text-[13px] text-muted-foreground">Check your connection, then try again.</p>
            <Button variant="outline" size="sm" className="mt-3 max-sm:h-11" onClick={loadItems}>
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-8 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">You&apos;re all caught up</p>
            <p className="text-[13px] text-muted-foreground">
              New notifications about your jobs and payments show up here.
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border">
            {items.map((n) => {
              const config = getNotificationTypeConfig(n.type)
              const Icon = config.icon
              const isOpen = openId === n.id
              const fullDate = formatFullDateTime(n.createdAt)
              const action = showActions ? notificationAction(n.rawType ?? "", n.payload) : null
              const excerpt = isMessageExcerpt(n.rawType, n.message)
              return (
                <DisclosureItem
                  key={n.id}
                  id={`notification-${n.id}`}
                  open={isOpen}
                  onToggle={() => setOpenId(isOpen ? null : n.id)}
                  headerRef={(el) => {
                    if (el) headerRefs.current.set(n.id, el)
                    else headerRefs.current.delete(n.id)
                  }}
                  leading={
                    <span
                      className={cn("flex h-8 w-8 items-center justify-center rounded-full", config.bg)}
                      aria-hidden="true"
                    >
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </span>
                  }
                  title={n.title}
                  time={n.time}
                  timeTitle={fullDate || undefined}
                  timeDateTime={n.createdAt}
                  unread={!n.isRead}
                  preview={n.message}
                >
                  <FullText>{n.message}</FullText>
                  {excerpt && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      This is the start of the message. Open the conversation to read the rest.
                    </p>
                  )}
                  {fullDate && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      <time dateTime={n.createdAt}>{fullDate}</time>
                    </p>
                  )}
                  {action && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="text-[13px] max-sm:h-11 max-sm:flex-1" asChild>
                        <Link href={action.href} onClick={() => handleOpenChange(false)}>
                          {action.label}
                        </Link>
                      </Button>
                    </div>
                  )}
                </DisclosureItem>
              )
            })}
          </ul>
        )}
      </InboxSurface>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  )
}
