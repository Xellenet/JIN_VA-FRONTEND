"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search,
  Send,
  ArrowLeft,
  UserRound,
  Loader2,
  MessageSquare,
} from "lucide-react"
import { cn, naviiAvatar } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import {
  contactName,
  formatMessageTime as fmt,
  type BackendConversation,
  type BackendDM,
} from "@/lib/messages"

// ── Props ─────────────────────────────────────────────────────────────────────

interface MessagesPageProps {
  readonly openConversationId?: string // contact user ID to pre-open (e.g. from artisan profile page)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MessagesPage({ openConversationId }: MessagesPageProps) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<BackendConversation[]>([])
  const [selected, setSelected] = useState<BackendConversation | null>(null)
  const [messages, setMessages] = useState<BackendDM[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingConvs, setIsLoadingConvs] = useState(true)
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── Load conversations ────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const r = await apiFetch<BackendConversation[]>("/direct-messages/conversations")
      const items = Array.isArray(r) ? r : []
      setConversations(items)
      return items
    } catch {
      return [] as BackendConversation[]
    } finally {
      setIsLoadingConvs(false)
    }
  }, [])

  useEffect(() => {
    loadConversations().then((items) => {
      if (!openConversationId) return
      const found = items.find((c) => String(c.contact.id) === String(openConversationId))
      if (found) {
        setSelected(found)
      } else {
        // New conversation — placeholder until first message is sent
        const placeholder: BackendConversation = {
          contact: { id: Number(openConversationId), firstname: "New", lastname: "Conversation", profilePicture: null },
          lastMessage: "",
          lastMessageTime: new Date().toISOString(),
          lastSenderId: 0,
          unreadCount: 0,
        }
        // Guard against inserting the same placeholder twice — the conversation
        // list is keyed on contact.id, and this effect can run more than once
        // for the same deep link (React StrictMode double-invokes it in dev,
        // and a re-run would otherwise stack duplicates). Surfaced by MC1:
        // until the artisan route passed ?client= through, this branch was
        // only ever reachable from the customer route.
        setConversations((prev) =>
          prev.some((c) => String(c.contact.id) === String(openConversationId))
            ? prev
            : [placeholder, ...prev],
        )
        setSelected(placeholder)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConversationId])

  // ── Load messages when conversation is selected ───────────────────────────

  useEffect(() => {
    if (!selected) return
    setIsLoadingMsgs(true)
    setMessages([])
    apiFetch<{ items: BackendDM[] } | BackendDM[]>(
      `/direct-messages/${selected.contact.id}?page=1&limit=50`
    )
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: BackendDM[] }).items ?? []
        setMessages(items)
        // Mark read + clear badge
        apiFetch(`/direct-messages/${selected.contact.id}/read`, { method: "PATCH" }).catch(() => {})
        setConversations((prev) =>
          prev.map((c) =>
            c.contact.id === selected.contact.id ? { ...c, unreadCount: 0 } : c
          )
        )
      })
      .catch(() => setMessages([]))
      .finally(() => setIsLoadingMsgs(false))
  }, [selected?.contact.id])

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  // ── Poll for new messages every 8 s when a conversation is open ───────────

  useEffect(() => {
    if (!selected) return
    const id = setInterval(() => {
      apiFetch<{ items: BackendDM[] } | BackendDM[]>(
        `/direct-messages/${selected.contact.id}?page=1&limit=50`
      )
        .then((r) => {
          const items = Array.isArray(r) ? r : (r as { items: BackendDM[] }).items ?? []
          // Only update if count changed to avoid wiping an in-flight optimistic message
          setMessages((prev) => (items.length !== prev.length ? items : prev))
        })
        .catch(() => {})
    }, 8_000)
    return () => clearInterval(id)
  }, [selected?.contact.id])

  // ── Derived ───────────────────────────────────────────────────────────────

  if (!user) return null

  const filtered = conversations.filter((c) => {
    if (!searchQuery) return true
    return contactName(c.contact).toLowerCase().includes(searchQuery.toLowerCase())
  })

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!newMessage.trim() || !selected || isSending) return
    const content = newMessage.trim()
    setNewMessage("")
    setIsSending(true)

    const tempId = -(Date.now())
    const tempMsg: BackendDM = {
      id: tempId,
      content,
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

    try {
      const sent = await apiFetch<BackendDM>(
        `/direct-messages/${selected.contact.id}`,
        { method: "POST", body: JSON.stringify({ content }) }
      )
      setMessages((prev) => prev.map((m) => (m.id === tempId ? sent : m)))
      // Bubble conversation to top with latest message
      setConversations((prev) => {
        const list = prev.map((c) =>
          c.contact.id === selected.contact.id
            ? { ...c, lastMessage: content, lastMessageTime: sent.createdAt, lastSenderId: Number(user.id) }
            : c
        )
        const idx = list.findIndex((c) => c.contact.id === selected.contact.id)
        if (idx > 0) {
          const [item] = list.splice(idx, 1)
          list.unshift(item)
        }
        return list
      })
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewMessage(content)
      toast.error(err instanceof Error ? err.message : "Failed to send message.")
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
                  const isActive = selected?.contact.id === conv.contact.id
                  const isLastByMe = conv.lastSenderId === Number(user.id)
                  return (
                    <button
                      key={conv.contact.id}
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
                          {conv.lastMessageTime && (
                            <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                              {fmt(conv.lastMessageTime)}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <p className={cn(
                            "mt-0.5 truncate text-xs",
                            conv.unreadCount > 0 ? "font-medium text-foreground/80" : "text-muted-foreground",
                          )}>
                            {isLastByMe && <span>You: </span>}
                            {conv.lastMessage}
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
                              <p className="break-words text-[14px] leading-relaxed">{msg.content}</p>
                              <p
                                className={cn(
                                  "mt-1 text-right text-[10px]",
                                  isOwn ? "text-white/60" : "text-muted-foreground",
                                )}
                              >
                                {fmt(msg.createdAt)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="border-t border-border bg-background px-4 py-3">
                  <div className="mx-auto flex max-w-2xl items-end gap-2">
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
                        newMessage.trim()
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground",
                      )}
                      onClick={handleSend}
                      disabled={!newMessage.trim() || isSending}
                    >
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
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
