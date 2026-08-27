"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Mail, MessageSquare, UserRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"
import { cn, resolveAvatarUrl } from "@/lib/utils"
import {
  contactName,
  conversationHref,
  conversationTimestamp,
  countUnreadConversations,
  formatMessageTime,
  lastMessagePreview,
  type BackendConversation,
} from "@/lib/messages"
import { HeaderIconBadge, POPOVER_POLL_MS, PREVIEW_ROW_LIMIT } from "./header-badge"

/**
 * HB1 / design-spec.md section 3 — the Mail icon's real unread badge and
 * preview dropdown.
 *
 * There is no dedicated "unread conversations" endpoint and this feature does
 * not add one: the badge count is derived client-side as the number of
 * conversations with `unreadCount > 0` from the conversation list the app
 * already fetches. Rows reuse the conversation list's own avatar + numeric
 * unread badge + "You: " prefix conventions.
 */
export function MessagesPopover({
  roleBase,
  role,
  currentUserId,
}: Readonly<{ roleBase: string; role: string; currentUserId: string }>) {
  const [open, setOpen] = useState(false)
  const [conversations, setConversations] = useState<BackendConversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const load = useCallback(async () => {
    setHasError(false)
    try {
      // MB1 — the canonical, paginated conversation list (api-contract.md §2).
      // The dropdown only previews 5 rows, but the badge counts every
      // conversation with unread messages, so this asks for the endpoint's
      // maximum page rather than 5.
      const r = await apiFetch<BackendConversation[] | { items: BackendConversation[] }>(
        "/messages?page=1&limit=50",
      )
      setConversations(Array.isArray(r) ? r : r?.items ?? [])
    } catch {
      setHasError(true)
      setConversations([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Loaded on mount (the badge must be accurate before the dropdown is opened)
  // and polled so it clears itself once the user reads everything.
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

  // Refresh on open so a peek is never showing a cache up to 30s stale.
  useEffect(() => {
    if (open) load()
  }, [open, load])

  const unreadConversations = countUnreadConversations(conversations)
  const preview = conversations.slice(0, PREVIEW_ROW_LIMIT)

  const retry = () => {
    setIsLoading(true)
    load()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Messages">
          <Mail className="h-[1.1rem] w-[1.1rem] text-muted-foreground" />
          <HeaderIconBadge count={unreadConversations} />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Messages</span>
          {unreadConversations > 0 && (
            <span className="text-xs text-muted-foreground">{unreadConversations} unread</span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-1 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-1 py-2">
                  <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-2.5 w-2/5" />
                    <Skeleton className="h-2.5 w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : hasError ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-xs font-semibold text-foreground">Couldn&apos;t load messages</p>
              <button
                type="button"
                onClick={retry}
                className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
              >
                Retry
              </button>
            </div>
          ) : preview.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <p className="text-xs font-semibold text-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {preview.map((conv) => {
                const name = contactName(conv.contact)
                const isLastByMe = conv.lastMessage?.senderId === Number(currentUserId)
                const lastMessageText = lastMessagePreview(conv.lastMessage)
                const timestamp = conversationTimestamp(conv)
                return (
                  <Link
                    key={conv.id}
                    href={conversationHref(role, roleBase, conv.contact.id)}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50",
                      conv.unreadCount > 0 && "bg-accent/50",
                    )}
                  >
                    <div className="relative mt-0.5 flex-shrink-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={resolveAvatarUrl(conv.contact.profilePicture, name)} alt={name} />
                        <AvatarFallback>
                          <UserRound className="h-3.5 w-3.5" />
                        </AvatarFallback>
                      </Avatar>
                      {conv.unreadCount > 0 && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-1 ring-popover">
                          {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-xs text-foreground",
                            conv.unreadCount > 0 ? "font-semibold" : "font-medium",
                          )}
                        >
                          {name}
                        </span>
                        {timestamp && (
                          <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                            {formatMessageTime(timestamp)}
                          </span>
                        )}
                      </div>
                      {lastMessageText && (
                        <p
                          className={cn(
                            "mt-0.5 line-clamp-1 text-[11px]",
                            conv.unreadCount > 0 ? "font-medium text-foreground/80" : "text-muted-foreground",
                          )}
                        >
                          {isLastByMe && <span>You: </span>}
                          {lastMessageText}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs font-medium" asChild>
            <Link href={`${roleBase}/messages`} onClick={() => setOpen(false)}>
              View all messages
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
