"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Lock, MessagesSquare } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch, ApiError } from "@/lib/api"
import { cn, naviiAvatar } from "@/lib/utils"
import { MessageImage } from "@/components/messages/message-image"
import {
  contactName,
  formatMessageDay,
  formatMessageTime,
  lastMessagePreview,
  type BackendContact,
  type BackendDM,
} from "@/lib/messages"

/**
 * AD1/AD2 — the read-only, dispute-scoped conversation viewer
 * (design-spec.md §4, api-contract.md §4).
 *
 * `GET /admin/disputes/:id/conversation` is the **only** way an admin can read
 * a conversation they are not a participant of. It takes no user or
 * conversation id — the pair is derived server-side from the dispute's booking
 * — so there is no parameter this component could substitute to reach an
 * unrelated thread, and no compose box renders anywhere in here (AD2, and
 * there is no admin write path into a customer↔artisan thread in the API).
 *
 * Bubbles deliberately do **not** use `bg-primary`: everywhere else in the app
 * that tone means "my own message", and the admin is neither participant.
 */

interface DisputeConversation {
  conversationId: number
  disputeId: number
  bookingId: number
  customer: BackendContact
  artisan: BackendContact
  totalMessages: number
  messages: BackendDM[]
  readOnly: boolean
}

type PanelState =
  | { kind: "loading" }
  | { kind: "closed" } // dispute settled — access ends with it (api-contract.md §4)
  | { kind: "empty" } // no conversation on file
  | { kind: "error" }
  | { kind: "ready"; conversation: DisputeConversation }

/** Disputes the endpoint will serve — anything else is a 403 by design. */
const OPEN_STATUSES = ["OPEN", "UNDER_REVIEW"]

function roleLabel(contact: BackendContact, fallback: "Client" | "Artisan"): string {
  if (contact.role === "CUSTOMER") return "Client"
  if (contact.role === "ARTISAN") return "Artisan"
  return fallback
}

export function DisputeConversationPanel({
  disputeId,
  disputeStatus,
  bookingLabel,
}: Readonly<{ disputeId: number; disputeStatus: string; bookingLabel?: string }>) {
  const [state, setState] = useState<PanelState>({ kind: "loading" })
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const load = useCallback(async () => {
    if (!OPEN_STATUSES.includes(disputeStatus)) {
      setState({ kind: "closed" })
      return
    }
    setState({ kind: "loading" })
    try {
      const data = await apiFetch<DisputeConversation | null>(`/admin/disputes/${disputeId}/conversation`)
      // `data: null` with a 200 is the expected "these two never messaged"
      // case, not a failure (api-contract.md §4).
      setState(data ? { kind: "ready", conversation: data } : { kind: "empty" })
    } catch (err) {
      // 403 means the dispute stopped being open work between render and
      // fetch — same message as the pre-checked case, never a bare error toast.
      setState(err instanceof ApiError && err.status === 403 ? { kind: "closed" } : { kind: "error" })
    }
  }, [disputeId, disputeStatus])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MessagesSquare className="h-3.5 w-3.5" />
        Conversation
      </p>

      {state.kind === "loading" && (
        <div className="space-y-2 py-1">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      )}

      {state.kind === "closed" && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Conversation access closed with this dispute.
        </p>
      )}

      {state.kind === "empty" && (
        <p className="text-sm text-muted-foreground">No conversation on file for this dispute.</p>
      )}

      {state.kind === "error" && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          <p className="text-sm text-muted-foreground">Couldn&apos;t load conversation</p>
          <button
            type="button"
            onClick={load}
            className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {state.kind === "ready" && (
        <ReadyPanel
          conversation={state.conversation}
          disputeId={disputeId}
          bookingLabel={bookingLabel}
          isSheetOpen={isSheetOpen}
          onSheetOpenChange={setIsSheetOpen}
        />
      )}
    </div>
  )
}

function ReadyPanel({
  conversation,
  disputeId,
  bookingLabel,
  isSheetOpen,
  onSheetOpenChange,
}: Readonly<{
  conversation: DisputeConversation
  disputeId: number
  bookingLabel?: string
  isSheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
}>) {
  const { customer, artisan } = conversation
  const messages = conversation.messages ?? []
  const totalMessages = conversation.totalMessages ?? messages.length
  const preview = messages.slice(-2)
  const isTruncated = totalMessages > messages.length

  return (
    <>
      <p className="text-sm font-medium text-foreground">
        {contactName(customer)} ({roleLabel(customer, "Client")}) ↔ {contactName(artisan)} (
        {roleLabel(artisan, "Artisan")})
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {totalMessages} message{totalMessages === 1 ? "" : "s"}
        {isTruncated && ` · showing the most recent ${messages.length}`}
      </p>

      <div className="mt-2 space-y-1">
        {preview.map((msg) => {
          const isCustomer = msg.sender.id === customer.id
          return (
            <p key={msg.id} className="truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {isCustomer ? roleLabel(customer, "Client") : roleLabel(artisan, "Artisan")}:
              </span>{" "}
              {lastMessagePreview({
                id: msg.id,
                content: msg.content,
                attachmentUrl: msg.attachmentUrl,
                senderId: msg.sender.id,
                createdAt: msg.createdAt,
                isRead: msg.isRead,
              })}
            </p>
          )
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-3 h-7 bg-transparent text-xs"
        onClick={() => onSheetOpenChange(true)}
      >
        View Full Conversation ({totalMessages})
      </Button>

      <Sheet open={isSheetOpen} onOpenChange={onSheetOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:w-[420px] sm:max-w-[420px]">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Conversation — Dispute #{disputeId}</SheetTitle>
            <SheetDescription>
              {bookingLabel ?? `Booking #${conversation.bookingId}`}
            </SheetDescription>
            <div>
              <Badge variant="outline" className="text-[10px]">
                Read-only — admin view
              </Badge>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 px-4 py-4">
            {isTruncated && (
              <p className="text-center text-[11px] text-muted-foreground">
                Showing the most recent {messages.length} of {totalMessages} messages.
              </p>
            )}
            {messages.map((msg, idx) => {
              const isCustomer = msg.sender.id === customer.id
              const prev = messages[idx - 1]
              const showDay =
                !prev || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString()
              const senderName = contactName(msg.sender)
              const label = isCustomer ? roleLabel(customer, "Client") : roleLabel(artisan, "Artisan")

              return (
                <div key={msg.id} className="space-y-1.5">
                  {showDay && (
                    <div className="flex justify-center">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {formatMessageDay(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={cn("flex flex-col gap-1", isCustomer ? "items-start" : "items-end")}>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={msg.sender.profilePicture || naviiAvatar(senderName, 24)}
                          alt={senderName}
                        />
                        <AvatarFallback className="text-[10px]">{senderName[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] font-medium text-foreground">{senderName}</span>
                      <Badge variant="outline" className="text-[9px]">
                        {label}
                      </Badge>
                    </div>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2",
                        isCustomer
                          ? "rounded-tl-md border border-border bg-card text-foreground"
                          : "rounded-tr-md bg-muted text-foreground",
                      )}
                    >
                      {msg.attachmentUrl && (
                        <MessageImage url={msg.attachmentUrl} className="mb-1 max-w-[200px]" />
                      )}
                      {msg.content && (
                        <p className="break-words text-[13px] leading-relaxed">{msg.content}</p>
                      )}
                      <p className="mt-1 text-right text-[10px] text-muted-foreground">
                        {formatMessageTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No messages exchanged between these two users.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
