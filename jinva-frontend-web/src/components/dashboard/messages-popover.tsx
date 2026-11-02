"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ImageIcon, Mail, MessageSquare, Reply, UserX } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"
import { markConversationRead } from "@/lib/customer-api"
import { cn, resolveAvatarUrl } from "@/lib/utils"
import {
  contactName,
  conversationHref,
  conversationIdHref,
  conversationTimestamp,
  countUnreadConversations,
  formatMessageTime,
  isDeletedContact,
  shouldMarkReadOnExpand,
  unreadLine,
  usableContactId,
  type BackendConversation,
} from "@/lib/messages"
import { formatFullDateTime } from "@/lib/notifications"
import { HeaderIconBadge, POPOVER_POLL_MS, PREVIEW_ROW_LIMIT } from "./header-badge"
import { InboxSurface } from "./inbox/inbox-surface"
import { DisclosureItem, FullText } from "./inbox/disclosure-item"

/** FR-6.17: same 1 s dwell as the bell before a single unread counts as read. */
const READ_AFTER_MS = 1000

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

/**
 * The Mail icon's unread badge and menu (HB1), now with read in place
 * (item 6). Each conversation is a disclosure showing the full latest
 * message, with "Open conversation" and "Reply".
 *
 * - `lastMessage.attachmentUrl` is never loaded, linked or fetched here
 *   (SEC-20): a photo shows as a placeholder tile.
 * - Expanding marks the conversation read only when exactly one message is
 *   unread, after 1 s, bounded by `upToMessageId` (FR-6.17, M1).
 * - Polling continues for the badge, but the open menu shows the list as it
 *   was when it opened, so nothing moves under the reader (FR-6.19).
 */
export function MessagesPopover({
  roleBase,
  role,
  currentUserId,
}: Readonly<{ roleBase: string; role: string; currentUserId: string }>) {
  const [open, setOpen] = useState(false)
  const [conversations, setConversations] = useState<BackendConversation[]>([])
  /** What the open menu shows; frozen while the reader is interacting. */
  const [snapshot, setSnapshot] = useState<BackendConversation[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const attemptedRef = useRef(new Set<number>())
  const headerRefs = useRef(new Map<number, HTMLButtonElement>())
  const openRef = useRef(false)
  const openIdRef = useRef<number | null>(null)
  openRef.current = open
  openIdRef.current = openId

  const load = useCallback(async () => {
    setHasError(false)
    try {
      // The badge counts every conversation with unread messages, so this asks
      // for the endpoint's maximum page rather than 5.
      const r = await apiFetch<BackendConversation[] | { items: BackendConversation[] }>(
        "/messages?page=1&limit=50",
      )
      const list = Array.isArray(r) ? r : (r?.items ?? [])
      setConversations(list)
      // Before the reader has opened anything, the open menu may still take
      // the fresh list; after that the order holds until it is reopened.
      if (openRef.current && openIdRef.current === null) setSnapshot(list.slice(0, PREVIEW_ROW_LIMIT))
    } catch {
      setHasError(true)
      setConversations([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POPOVER_POLL_MS)
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [load])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    openRef.current = next
    if (next) {
      setSnapshot(conversations.length ? conversations.slice(0, PREVIEW_ROW_LIMIT) : null)
      load()
    } else {
      setOpenId(null)
      openIdRef.current = null
      setSnapshot(null)
      attemptedRef.current = new Set()
      setAnnouncement("")
    }
  }

  const setUnread = (conversationId: number, unreadCount: number) => {
    const apply = (list: BackendConversation[]) =>
      list.map((c) => (c.id === conversationId ? { ...c, unreadCount } : c))
    setConversations(apply)
    setSnapshot((s) => (s ? apply(s) : s))
  }

  // FR-6.17: read on expand only with exactly one unread, bounded by the
  // message on screen so one arriving meanwhile stays unread.
  useEffect(() => {
    if (openId === null || !snapshot) return
    const conv = snapshot.find((c) => c.id === openId)
    if (!conv || !shouldMarkReadOnExpand(conv.unreadCount) || attemptedRef.current.has(conv.id)) return
    const lastId = conv.lastMessage?.id
    if (typeof lastId !== "number" || !Number.isSafeInteger(lastId) || lastId <= 0) return
    const id = conv.id
    const timer = setTimeout(async () => {
      attemptedRef.current.add(id)
      setUnread(id, 0)
      setAnnouncement("Marked as read")
      try {
        await markConversationRead(id, lastId)
      } catch {
        setUnread(id, 1)
        setAnnouncement("")
      }
    }, READ_AFTER_MS)
    return () => clearTimeout(timer)
  }, [openId, snapshot])

  const collapseOpenItem = () => {
    if (openId === null) return false
    const header = headerRefs.current.get(openId)
    setOpenId(null)
    header?.focus()
    return true
  }

  const unreadConversations = countUnreadConversations(conversations)
  const rows = snapshot ?? []
  const showSkeleton = (isLoading || (open && snapshot === null && !hasError && conversations.length > 0)) && rows.length === 0
  const close = () => handleOpenChange(false)

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8"
      aria-label={unreadConversations > 0 ? `Messages, ${unreadConversations} unread` : "Messages"}
    >
      <Mail className="h-[1.1rem] w-[1.1rem] text-muted-foreground" />
      <HeaderIconBadge count={unreadConversations} />
    </Button>
  )

  return (
    <>
      <InboxSurface
        open={open}
        onOpenChange={handleOpenChange}
        trigger={trigger}
        label="Messages"
        onEscape={collapseOpenItem}
        heading={
          <>
            <h2 className="text-sm font-semibold text-foreground max-sm:text-base">Messages</h2>
            {unreadConversations > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">{unreadConversations} unread</span>
            )}
          </>
        }
        footer={
          <div className="p-2">
            <Button variant="ghost" size="sm" className="w-full text-[13px] font-medium max-sm:h-11" asChild>
              <Link href={`${roleBase}/messages`} onClick={close}>
                View all messages
              </Link>
            </Button>
          </div>
        }
      >
        {showSkeleton ? (
          <div className="space-y-1 p-3" aria-busy="true" aria-label="Loading messages">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-1 py-2">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-2.5 w-2/5" />
                  <Skeleton className="h-2.5 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        ) : hasError && rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-8 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">Couldn&apos;t load messages</p>
            <p className="text-[13px] text-muted-foreground">Check your connection, then try again.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 max-sm:h-11"
              onClick={() => {
                setIsLoading(true)
                load()
              }}
            >
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-8 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">No messages yet</p>
            <p className="text-[13px] text-muted-foreground">
              When you message an artisan, the latest reply shows up here.
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border">
            {rows.map((conv) => {
              const name = contactName(conv.contact)
              const deleted = isDeletedContact(conv.contact)
              const last = conv.lastMessage
              const isMine = !!last && last.senderId === Number(currentUserId)
              const text = last?.content?.trim() ? last.content : ""
              const hasPhoto = !!last?.attachmentUrl
              const timestamp = conversationTimestamp(conv)
              const fullDate = formatFullDateTime(last?.createdAt ?? timestamp)
              const isOpen = openId === conv.id
              const unread = conv.unreadCount > 0
              const strip = unreadLine(conv.unreadCount)
              const contactId = usableContactId(conv.contact)
              const openHref =
                contactId !== null && !deleted
                  ? conversationHref(role, roleBase, contactId)
                  : conversationIdHref(role, roleBase, conv.id)
              const replyHref =
                !deleted && contactId !== null && role === "user"
                  ? conversationHref(role, roleBase, contactId, { reply: true })
                  : null

              return (
                <DisclosureItem
                  key={conv.id}
                  id={`conversation-${conv.id}`}
                  open={isOpen}
                  onToggle={() => setOpenId(isOpen ? null : conv.id)}
                  headerRef={(el) => {
                    if (el) headerRefs.current.set(conv.id, el)
                    else headerRefs.current.delete(conv.id)
                  }}
                  leading={
                    <span className="relative block" aria-hidden="true">
                      {deleted ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <UserX className="h-4 w-4" />
                        </span>
                      ) : (
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={resolveAvatarUrl(conv.contact.profilePicture)} alt="" />
                          <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {unread && (
                        <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-popover">
                          {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                        </span>
                      )}
                    </span>
                  }
                  title={name}
                  titleClassName={deleted ? "italic text-muted-foreground" : undefined}
                  time={timestamp ? formatMessageTime(timestamp) : undefined}
                  timeTitle={fullDate || undefined}
                  timeDateTime={timestamp ?? undefined}
                  unread={unread}
                  dot={false}
                  preview={
                    text ? (
                      <>
                        {isMine && "You: "}
                        {text}
                      </>
                    ) : hasPhoto ? (
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        Photo
                      </span>
                    ) : undefined
                  }
                >
                  {text && (
                    <FullText>
                      {isMine && "You: "}
                      {text}
                    </FullText>
                  )}
                  {hasPhoto && (
                    <div className={cn("flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5", text && "mt-3")}>
                      <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground">Photo</p>
                        <p className="text-xs text-muted-foreground">Open conversation to view</p>
                      </div>
                    </div>
                  )}
                  {strip && (
                    <p className="mt-3 flex items-center gap-2 rounded-md bg-muted/70 px-3 py-2 text-xs text-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
                      <span>
                        <span className="font-semibold">{strip.split(" · ")[0]}</span>
                        {" · "}
                        {strip.split(" · ")[1]}
                      </span>
                    </p>
                  )}
                  {fullDate && <p className="mt-3 text-xs text-muted-foreground">Latest message, {fullDate}</p>}
                  {openHref && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="text-[13px] max-sm:h-11 max-sm:flex-1" asChild>
                        <Link href={openHref} onClick={close}>
                          Open conversation
                        </Link>
                      </Button>
                      {replyHref && (
                        <Button variant="outline" size="sm" className="text-[13px] max-sm:h-11 max-sm:flex-1" asChild>
                          <Link href={replyHref} onClick={close}>
                            <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                            Reply
                          </Link>
                        </Button>
                      )}
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
