"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search,
  Send,
  ArrowLeft,
  UserRound,
  Loader2,
  MessageSquare,
  Paperclip,
  X,
  AlertTriangle,
  Clock,
  Check,
  CheckCheck,
} from "lucide-react"
import { cn, naviiAvatar } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch, ApiError } from "@/lib/api"
import { toast } from "sonner"
import { MessageImage } from "@/components/messages/message-image"
import {
  contactName,
  conversationTimestamp,
  formatMessageTime as fmt,
  lastMessagePreview,
  validateAttachment,
  ATTACHMENT_ACCEPTED_TYPES,
  type BackendConversation,
  type BackendDM,
  type SendMessagePayload,
} from "@/lib/messages"

// ── Props ─────────────────────────────────────────────────────────────────────

interface MessagesPageProps {
  /** Contact **user** id to pre-open (`?artisan=`/`?client=` deep link). */
  readonly openConversationId?: string
  /** MC2 — job this conversation was opened from (`&job=`). */
  readonly jobId?: string
  /** MC2 — booking this conversation was opened from (`&booking=`). */
  readonly bookingId?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * `GET /messages` and `GET /messages/:id` both cap `limit` at 50
 * (api-contract.md §3) — asking for more is a 400, not a silent clamp.
 */
const PAGE_LIMIT = 50

/** Existing in-open-thread cadence (design-spec.md §8.1). */
const THREAD_POLL_MS = 8_000

/**
 * NR1 — the conversation list refreshes while the page is open, so unread
 * badges there don't go stale until the user navigates away and back.
 * design-spec.md §6.4 recommends 15–20s: lighter than the open thread's 8s,
 * tighter than the header dropdown's 30s so the two never visibly disagree.
 */
const CONVERSATION_LIST_POLL_MS = 15_000

/**
 * Sentinel id for a deep-linked pair who have never messaged. No conversation
 * row exists server-side yet (api-contract.md §2.1 step 3), so there is nothing
 * to read or mark read — it is created by the first `POST /messages`, after
 * which the list is re-fetched to pick up its real id.
 */
const PENDING_CONVERSATION_ID = -1

// ── Attachment composer state (MC4) ───────────────────────────────────────────

interface PendingAttachment {
  file: File
  /** Local object URL so the thumbnail appears instantly, before the upload lands. */
  previewUrl: string
  status: "uploading" | "ready" | "error"
  /** Set once `POST /uploads/message-attachment` returns — this is what gets sent. */
  url?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readList<T>(r: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(r)) return r
  return r?.items ?? []
}

/** MC2's job-context chip label (design-spec.md §6.3). */
interface MessageContext {
  label: string
  href?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MessagesPage({ openConversationId, jobId, bookingId }: MessagesPageProps) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<BackendConversation[]>([])
  const [selected, setSelected] = useState<BackendConversation | null>(null)
  const [messages, setMessages] = useState<BackendDM[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingConvs, setIsLoadingConvs] = useState(true)
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null)
  const [context, setContext] = useState<MessageContext | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedId = selected?.id ?? null
  const isPending = selectedId === PENDING_CONVERSATION_ID

  /**
   * MC2 context applies only to the conversation the deep link opened — if the
   * user switches to another thread in the list, that one is a general inquiry
   * and must not be tagged with someone else's job.
   */
  const contextApplies =
    !!openConversationId &&
    !!selected &&
    String(selected.contact.id) === String(openConversationId) &&
    (!!jobId || !!bookingId)

  // ── Load conversations (MB1: GET /messages, paginated) ────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const r = await apiFetch<BackendConversation[] | { items: BackendConversation[] }>(
        `/messages?page=1&limit=${PAGE_LIMIT}`,
      )
      const items = readList(r)
      setConversations((prev) => {
        // Keep a not-yet-created deep-link thread pinned while it has no
        // server-side row to come back in the list.
        const pending = prev.filter(
          (c) => c.id === PENDING_CONVERSATION_ID && !items.some((i) => i.contact.id === c.contact.id),
        )
        return [...pending, ...items]
      })
      return items
    } catch {
      return [] as BackendConversation[]
    } finally {
      setIsLoadingConvs(false)
    }
  }, [])

  // Initial load + deep-link resolution.
  useEffect(() => {
    loadConversations().then((items) => {
      if (!openConversationId) return
      const found = items.find((c) => String(c.contact.id) === String(openConversationId))
      if (found) {
        setSelected(found)
        return
      }
      // No conversation with this contact yet. There is no endpoint that
      // resolves an arbitrary user id to a name, so the row is labelled
      // neutrally and the real contact details arrive with the list re-fetch
      // after the first send. An id that turns out to be unreachable surfaces
      // as a 404 on that send, which drops back to the list (see handleSend).
      const placeholder: BackendConversation = {
        id: PENDING_CONVERSATION_ID,
        contact: {
          id: Number(openConversationId),
          firstname: "New",
          lastname: "conversation",
          profilePicture: null,
        },
        lastMessage: null,
        unreadCount: 0,
      }
      setConversations((prev) =>
        prev.some((c) => String(c.contact.id) === String(openConversationId))
          ? prev
          : [placeholder, ...prev],
      )
      setSelected(placeholder)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConversationId])

  // NR1 — keep the list (and its unread badges) fresh while the page is open.
  useEffect(() => {
    const id = setInterval(loadConversations, CONVERSATION_LIST_POLL_MS)
    const onFocus = () => loadConversations()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [loadConversations])

  // ── MC2 — resolve the job/booking title for the context chip ──────────────

  useEffect(() => {
    if (!jobId && !bookingId) {
      setContext(null)
      return
    }
    const roleBase = user?.role === "artisan" ? "/dashboard/artisan" : "/dashboard/user"
    let cancelled = false

    if (jobId) {
      // Fall back to the bare reference if the title can't be fetched — the
      // chip's job is to say *which* job, and the number alone still does that.
      setContext({ label: `Job #${jobId}`, href: `${roleBase}/jobs/${jobId}` })
      apiFetch<{ title?: string }>(`/jobs/${jobId}`)
        .then((job) => {
          if (cancelled || !job?.title) return
          setContext({ label: `${job.title} · Job #${jobId}`, href: `${roleBase}/jobs/${jobId}` })
        })
        .catch(() => {})
    } else if (bookingId) {
      // Only the customer dashboard has a booking detail route, so the artisan
      // side renders the chip without a link rather than a dead one.
      const href = user?.role === "artisan" ? undefined : `/dashboard/user/bookings/${bookingId}`
      setContext({ label: `Booking #${bookingId}`, href })
      apiFetch<{ service?: { name?: string } }>(`/bookings/${bookingId}`)
        .then((booking) => {
          if (cancelled || !booking?.service?.name) return
          setContext({ label: `${booking.service.name} · Booking #${bookingId}`, href })
        })
        .catch(() => {})
    }

    return () => {
      cancelled = true
    }
  }, [jobId, bookingId, user?.role])

  // ── Load messages when a conversation is selected ──────────────────────────

  useEffect(() => {
    if (selectedId === null) return
    setMessages([])
    setAttachment(null)
    if (selectedId === PENDING_CONVERSATION_ID) {
      // Nothing to fetch: this pair has no conversation row yet.
      setIsLoadingMsgs(false)
      return
    }
    setIsLoadingMsgs(true)
    apiFetch<BackendDM[] | { items: BackendDM[] }>(`/messages/${selectedId}?page=1&limit=${PAGE_LIMIT}`)
      .then((r) => {
        setMessages(readList(r))
        // MR1 — mark the other participant's messages read and clear the badge.
        apiFetch(`/messages/${selectedId}/read`, { method: "PATCH" }).catch(() => {})
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)),
        )
      })
      .catch(() => setMessages([]))
      .finally(() => setIsLoadingMsgs(false))
  }, [selectedId])

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  // ── Poll the open thread ──────────────────────────────────────────────────

  useEffect(() => {
    if (selectedId === null || selectedId === PENDING_CONVERSATION_ID) return
    const id = setInterval(() => {
      apiFetch<BackendDM[] | { items: BackendDM[] }>(`/messages/${selectedId}?page=1&limit=${PAGE_LIMIT}`)
        .then((r) => {
          const items = readList(r)
          // Optimistic bubbles carry negative ids and aren't on the server yet,
          // so they're re-appended rather than wiped by a poll landing mid-send.
          // MR2 depends on this poll for the sent -> read transition, so unlike
          // the old length-only comparison it always adopts the server's rows.
          setMessages((prev) => [...items, ...prev.filter((m) => m.id < 0)])
        })
        .catch(() => {})
    }, THREAD_POLL_MS)
    return () => clearInterval(id)
  }, [selectedId])

  // ── Derived ───────────────────────────────────────────────────────────────

  if (!user) return null

  const filtered = conversations.filter((c) => {
    if (!searchQuery) return true
    return contactName(c.contact).toLowerCase().includes(searchQuery.toLowerCase())
  })

  // ── MC4 — attachment picking / upload ─────────────────────────────────────

  const uploadAttachment = async (file: File, previewUrl: string) => {
    setAttachment({ file, previewUrl, status: "uploading" })
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await apiFetch<{ url: string }>("/uploads/message-attachment", {
        method: "POST",
        body: formData,
      })
      setAttachment({ file, previewUrl, status: "ready", url: res.url })
    } catch {
      // Never silently send text-only — the chip switches to a retry affordance
      // and the send is blocked until it succeeds or the image is removed.
      setAttachment({ file, previewUrl, status: "error" })
    }
  }

  const handlePickFile = (files: FileList | null) => {
    const file = files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (!file) return
    const error = validateAttachment(file)
    if (error) {
      toast.error(error)
      return
    }
    if (attachment) URL.revokeObjectURL(attachment.previewUrl)
    uploadAttachment(file, URL.createObjectURL(file))
  }

  const removeAttachment = () => {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl)
    setAttachment(null)
  }

  const retryAttachment = () => {
    if (!attachment) return
    uploadAttachment(attachment.file, attachment.previewUrl)
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  const canSend = (!!newMessage.trim() || !!attachment) && !!selected && !isSending

  const handleSend = async () => {
    if (!selected || isSending) return
    const content = newMessage.trim()
    if (!content && !attachment) return

    if (attachment?.status === "uploading") {
      toast.info("Still attaching your image — one moment.")
      return
    }
    if (attachment?.status === "error") {
      toast.error("Couldn't attach — tap the image to retry.")
      return
    }

    const outgoing = attachment
    setNewMessage("")
    setAttachment(null)
    setIsSending(true)

    const tempId = -Date.now()
    const tempMsg: BackendDM = {
      id: tempId,
      content: content || null,
      attachmentUrl: outgoing?.url ?? null,
      attachmentType: outgoing?.file.type ?? null,
      jobId: null,
      bookingId: null,
      isRead: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: Number(user.id),
        firstname: user.name.split(" ")[0],
        lastname: user.name.split(" ").slice(1).join(" "),
        profilePicture: user.avatar ?? null,
      },
    }
    setMessages((prev) => [...prev, tempMsg])

    const payload: SendMessagePayload = { recipientId: selected.contact.id }
    if (content) payload.content = content
    if (outgoing?.url) payload.attachmentUrl = outgoing.url
    if (contextApplies && jobId) payload.jobId = Number(jobId)
    else if (contextApplies && bookingId) payload.bookingId = Number(bookingId)

    try {
      let sent: BackendDM
      try {
        sent = await apiFetch<BackendDM>("/messages", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      } catch (err: unknown) {
        // MC2's job/booking reference is optional metadata, and participation in
        // it is enforced server-side with a 403 (api-contract.md §3). A stale or
        // non-participant reference must not stop the message itself going out,
        // so it is dropped and the send retried once as a general inquiry.
        const taggedRejected =
          err instanceof ApiError && err.status === 403 && (payload.jobId != null || payload.bookingId != null)
        if (!taggedRejected) throw err
        delete payload.jobId
        delete payload.bookingId
        sent = await apiFetch<BackendDM>("/messages", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      setMessages((prev) => prev.map((m) => (m.id === tempId ? sent : m)))
      if (outgoing) URL.revokeObjectURL(outgoing.previewUrl)

      if (isPending) {
        // First contact: the conversation now exists server-side, so pick up
        // its real id (and the contact's real name) from the list.
        const items = await loadConversations()
        const created = items.find((c) => c.contact.id === selected.contact.id)
        if (created) {
          setConversations((prev) => prev.filter((c) => c.id !== PENDING_CONVERSATION_ID))
          setSelected(created)
        }
        return
      }

      // Bubble the conversation to the top with the latest message.
      setConversations((prev) => {
        const list = prev.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                lastMessageAt: sent.createdAt,
                lastMessage: {
                  id: sent.id,
                  content: sent.content,
                  attachmentUrl: sent.attachmentUrl,
                  senderId: Number(user.id),
                  createdAt: sent.createdAt,
                  isRead: false,
                },
              }
            : c,
        )
        const idx = list.findIndex((c) => c.id === selected.id)
        if (idx > 0) {
          const [item] = list.splice(idx, 1)
          list.unshift(item)
        }
        return list
      })
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewMessage(content)
      if (outgoing) setAttachment(outgoing)

      const status = err instanceof ApiError ? err.status : 0
      const message = err instanceof Error ? err.message : "Failed to send message."
      // RL1 — the server's own copy is already user-facing; this only guards
      // against a bare/absent body so a rate limit is never a raw 429.
      if (status === 429) {
        toast.error(message || "You're sending messages too fast. Try again shortly.")
      } else {
        toast.error(message)
      }
      // A deep link pointing at a user who doesn't exist (or isn't reachable)
      // only fails at this point — fall back to the conversation list rather
      // than leaving a thread addressed to nobody on screen.
      if (status === 404 && isPending) {
        setConversations((prev) => prev.filter((c) => c.id !== PENDING_CONVERSATION_ID))
        setSelected(null)
        setNewMessage("")
      }
    } finally {
      setIsSending(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-0 overflow-hidden md:h-[calc(100vh-7rem)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Messages</p>
            <h1 className="mt-0.5 text-2xl font-bold text-foreground">Inbox</h1>
            <p className="text-sm text-muted-foreground">
              {conversations.length > 0
                ? `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`
                : "No conversations yet"}
            </p>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          {/* ── Conversation list ──────────────────────────────────────────── */}
          <div
            className={cn(
              "flex w-full flex-col bg-background md:w-80 lg:w-96",
              selected ? "hidden md:flex" : "flex",
            )}
          >
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  className="rounded-full bg-muted/60 pl-9 text-sm border-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingConvs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No conversations match your search." : "No conversations yet."}
                  </p>
                </div>
              ) : (
                filtered.map((conv) => {
                  const name = contactName(conv.contact)
                  const isActive = selected?.id === conv.id
                  const isLastByMe = conv.lastMessage?.senderId === Number(user.id)
                  const preview = lastMessagePreview(conv.lastMessage)
                  const timestamp = conversationTimestamp(conv)
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => setSelected(conv)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50",
                        isActive && "bg-accent",
                      )}
                    >
                      <div className="relative flex-shrink-0 mt-0.5">
                        <Avatar className="h-11 w-11">
                          <AvatarImage src={conv.contact.profilePicture || naviiAvatar(name)} alt={name} />
                          <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        {conv.unreadCount > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            "truncate text-sm",
                            conv.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90",
                          )}>
                            {name}
                          </span>
                          {timestamp && (
                            <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                              {fmt(timestamp)}
                            </span>
                          )}
                        </div>
                        {preview && (
                          <p className={cn(
                            "mt-0.5 truncate text-xs",
                            conv.unreadCount > 0 ? "font-medium text-foreground/80" : "text-muted-foreground",
                          )}>
                            {isLastByMe && <span>You: </span>}
                            {preview}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Divider ───────────────────────────────────────────────────── */}
          <div className="hidden w-px bg-border md:block" />

          {/* ── Chat panel ────────────────────────────────────────────────── */}
          <div className={cn("flex flex-1 flex-col", !selected ? "hidden md:flex" : "flex")}>
            {selected ? (
              <>
                {/* Chat header */}
                {(() => {
                  const name = contactName(selected.contact)
                  return (
                    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 md:hidden"
                        onClick={() => setSelected(null)}
                      >
                        <ArrowLeft className="h-5 w-5 text-primary" />
                      </Button>
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={selected.contact.profilePicture || naviiAvatar(name)} alt={name} />
                        <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-foreground">{name}</h3>
                        {/* MC2 — job/booking context chip; absent for a
                            conversation opened generically (design-spec.md §6.3). */}
                        {contextApplies && context && (
                          <Badge
                            variant="outline"
                            className="mt-1 max-w-full border-primary/20 bg-primary/5 text-[10px] font-medium text-primary"
                            asChild={!!context.href}
                          >
                            {context.href ? (
                              <Link href={context.href} className="truncate">
                                Regarding: {context.label}
                              </Link>
                            ) : (
                              <span className="truncate">Regarding: {context.label}</span>
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Message thread */}
                <div className="flex-1 overflow-y-auto bg-muted/20 px-4 py-4">
                  {isLoadingMsgs ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-2xl flex-col gap-1">
                      {messages.map((msg, idx) => {
                        const isOwn = msg.sender.id === Number(user.id)
                        const prev = messages[idx - 1]
                        const next = messages[idx + 1]
                        const isFirst = !prev || prev.sender.id !== msg.sender.id
                        const isLast = !next || next.sender.id !== msg.sender.id
                        const showAvatar = !isOwn && isLast
                        const senderName = `${msg.sender.firstname} ${msg.sender.lastname}`.trim()
                        // MR2 — sending -> sent -> read, own messages only.
                        // A negative id is an optimistic bubble the server
                        // hasn't confirmed yet.
                        const isSendingBubble = msg.id < 0

                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex items-end gap-2",
                              isOwn ? "flex-row-reverse" : "flex-row",
                              isLast ? "mb-3" : "mb-0.5",
                            )}
                          >
                            <div className="w-7 flex-shrink-0">
                              {!isOwn && showAvatar && (
                                <Avatar className="h-7 w-7">
                                  <AvatarImage
                                    src={msg.sender.profilePicture || naviiAvatar(senderName)}
                                    alt={senderName}
                                  />
                                  <AvatarFallback><UserRound className="h-3 w-3" /></AvatarFallback>
                                </Avatar>
                              )}
                            </div>

                            <div
                              className={cn(
                                "max-w-[70%] px-3.5 py-2",
                                isOwn
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-card text-foreground border border-border",
                                isOwn
                                  ? cn(
                                      "rounded-2xl",
                                      isFirst && isLast && "rounded-br-md",
                                      isFirst && !isLast && "rounded-br-md",
                                      !isFirst && isLast && "rounded-tr-md rounded-br-md",
                                      !isFirst && !isLast && "rounded-r-md",
                                    )
                                  : cn(
                                      "rounded-2xl",
                                      isFirst && isLast && "rounded-bl-md",
                                      isFirst && !isLast && "rounded-bl-md",
                                      !isFirst && isLast && "rounded-tl-md rounded-bl-md",
                                      !isFirst && !isLast && "rounded-l-md",
                                    ),
                              )}
                            >
                              {/* MC4 — an image message, with or without a caption. */}
                              {msg.attachmentUrl && (
                                <MessageImage url={msg.attachmentUrl} className="mb-1 max-w-[240px]" />
                              )}
                              {msg.content && (
                                <p className="break-words text-[14px] leading-relaxed">{msg.content}</p>
                              )}
                              <div
                                className={cn(
                                  "mt-1 flex items-center justify-end gap-1 text-[10px]",
                                  isOwn ? "text-white/60" : "text-muted-foreground",
                                )}
                              >
                                <span>{fmt(msg.createdAt)}</span>
                                {isOwn && (
                                  <>
                                    {isSendingBubble && <Clock className="h-3 w-3" aria-label="Sending" />}
                                    {!isSendingBubble && !msg.isRead && (
                                      <Check className="h-3 w-3" aria-label="Sent" />
                                    )}
                                    {!isSendingBubble && msg.isRead && (
                                      <CheckCheck className="h-3 w-3 text-white" aria-label="Read" />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                {/* Composer */}
                <div className="border-t border-border bg-background px-4 py-3">
                  <div className="mx-auto max-w-2xl space-y-2">
                    {/* MC4 — pending attachment chip (design-spec.md §6.1) */}
                    {attachment && (
                      <div className="flex items-center gap-2">
                        <div className="relative h-14 w-14 flex-shrink-0">
                          <button
                            type="button"
                            onClick={attachment.status === "error" ? retryAttachment : undefined}
                            className={cn(
                              "h-14 w-14 overflow-hidden rounded-lg border border-border bg-muted",
                              attachment.status === "error" && "cursor-pointer border-destructive/40",
                            )}
                            aria-label={attachment.status === "error" ? "Retry attaching image" : "Attached image"}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={attachment.previewUrl}
                              alt="Attachment preview"
                              className="h-full w-full object-cover"
                            />
                          </button>
                          {attachment.status === "uploading" && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-foreground/50">
                              <Loader2 className="h-4 w-4 animate-spin text-background" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={removeAttachment}
                            aria-label="Remove attachment"
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        {attachment.status === "error" && (
                          <button
                            type="button"
                            onClick={retryAttachment}
                            className="flex items-center gap-1.5 text-xs font-medium text-destructive"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Couldn&apos;t attach — tap to retry
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-end gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ATTACHMENT_ACCEPTED_TYPES.join(",")}
                        className="hidden"
                        onChange={(e) => handlePickFile(e.target.files)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 flex-shrink-0 rounded-full text-muted-foreground"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Attach an image"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Input
                        placeholder="Message"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSend()
                          }
                        }}
                        className="flex-1 rounded-full border-border bg-muted/40 text-sm focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <Button
                        size="icon"
                        className={cn(
                          "h-9 w-9 flex-shrink-0 rounded-full transition-colors",
                          canSend
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-muted text-muted-foreground",
                        )}
                        onClick={handleSend}
                        disabled={!canSend}
                        aria-label="Send message"
                      >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">JPEG or PNG · max 5MB · one image per message</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Send className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">Your messages</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Select a conversation from the sidebar to start chatting.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
