"use client"

import { useState, useRef, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Send,
  Paperclip,
  ArrowLeft,
  Plus,
  ChevronRight,
  Check,
  CheckCheck,
} from "lucide-react"
import { mockConversations, mockMessages } from "@/lib/data/mock-data"
import type { ChatConversation, ChatMessage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"

interface MessagesPageProps {
  openConversationId?: string
}

export function MessagesPage({ openConversationId }: MessagesPageProps) {
  const { user } = useAuth()
  if (!user) return null
  const [conversations] = useState<ChatConversation[]>(mockConversations)
  const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(() => {
    if (openConversationId) {
      return mockConversations.find((c) => c.id === openConversationId || c.participantId === openConversationId) || null
    }
    return null
  })
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages)
  const [newMessage, setNewMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentUserId = user.id === "1" ? "1" : user.role === "artisan" ? "p1" : "c1"

  const filteredConversations = conversations.filter((c) =>
    c.participantName.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const currentMessages = selectedConv
    ? messages.filter((m) => m.conversationId === selectedConv.id)
    : []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [currentMessages.length])

  const handleSend = () => {
    if (!newMessage.trim() || !selectedConv) return
    const msg: ChatMessage = {
      id: `m-new-${Date.now()}`,
      conversationId: selectedConv.id,
      senderId: currentUserId,
      senderName: user.name,
      senderAvatar: user.avatar,
      content: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      isRead: false,
    }
    setMessages((prev) => [...prev, msg])
    setNewMessage("")
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-0 overflow-hidden md:h-[calc(100vh-7rem)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Messages</h1>
            <p className="text-sm text-muted-foreground">
              {totalUnread > 0
                ? `You have ${totalUnread} unread message${totalUnread > 1 ? "s" : ""}`
                : "All caught up"}
            </p>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          {/* Conversation List - iPhone style */}
          <div
            className={cn(
              "flex w-full flex-col bg-background md:w-80 lg:w-96",
              selectedConv ? "hidden md:flex" : "flex",
            )}
          >
            {/* Search header */}
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search"
                  className="rounded-full bg-muted/60 pl-9 text-sm border-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Conversation items */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Search className="mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No conversations found</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConv(conv)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      selectedConv?.id === conv.id && "bg-accent",
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conv.participantAvatar || "/placeholder.svg"} alt={conv.participantName} />
                        <AvatarFallback>{conv.participantName.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      {conv.isOnline && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {conv.participantName}
                        </span>
                        <span className="flex-shrink-0 text-[11px] text-muted-foreground">{conv.lastMessageTime}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{conv.lastMessage}</p>
                        {conv.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden w-px bg-border md:block" />

          {/* Chat Panel - iMessage style */}
          <div
            className={cn(
              "flex flex-1 flex-col",
              !selectedConv ? "hidden md:flex" : "flex",
            )}
          >
            {selectedConv ? (
              <>
                {/* Chat Header */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 md:hidden"
                    onClick={() => setSelectedConv(null)}
                  >
                    <ArrowLeft className="h-5 w-5 text-primary" />
                  </Button>
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedConv.participantAvatar || "/placeholder.svg"} alt={selectedConv.participantName} />
                      <AvatarFallback>{selectedConv.participantName.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    {selectedConv.isOnline && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-center md:text-left">
                    <h3 className="text-sm font-semibold text-foreground">{selectedConv.participantName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedConv.isOnline ? "Online" : "Offline"}
                      {" -- "}
                      <span className="capitalize">{selectedConv.participantRole}</span>
                    </p>
                  </div>
                </div>

                {/* Messages Area - iMessage bubbles */}
                <div className="flex-1 overflow-y-auto bg-muted/20 px-4 py-4">
                  <div className="mx-auto flex max-w-2xl flex-col gap-1">
                    {currentMessages.map((msg, idx) => {
                      const isOwn = msg.senderId === currentUserId
                      const prev = currentMessages[idx - 1]
                      const next = currentMessages[idx + 1]
                      const isFirstInGroup = !prev || prev.senderId !== msg.senderId
                      const isLastInGroup = !next || next.senderId !== msg.senderId
                      const showAvatar = !isOwn && isLastInGroup

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex items-end gap-2",
                            isOwn ? "flex-row-reverse" : "flex-row",
                            isLastInGroup ? "mb-3" : "mb-0.5",
                          )}
                        >
                          {/* Avatar placeholder for alignment */}
                          {!isOwn && (
                            <div className="w-7 flex-shrink-0">
                              {showAvatar && (
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={msg.senderAvatar || "/placeholder.svg"} alt={msg.senderName} />
                                  <AvatarFallback className="text-[10px]">{msg.senderName.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          )}

                          <div
                            className={cn(
                              "max-w-[70%] px-3.5 py-2",
                              isOwn
                                ? "bg-primary text-primary-foreground"
                                : "bg-card text-foreground border border-border",
                              // iPhone-style bubble radius
                              isOwn
                                ? cn(
                                    "rounded-2xl",
                                    isFirstInGroup && isLastInGroup && "rounded-br-md",
                                    isFirstInGroup && !isLastInGroup && "rounded-br-md",
                                    !isFirstInGroup && isLastInGroup && "rounded-tr-md rounded-br-md",
                                    !isFirstInGroup && !isLastInGroup && "rounded-r-md",
                                  )
                                : cn(
                                    "rounded-2xl",
                                    isFirstInGroup && isLastInGroup && "rounded-bl-md",
                                    isFirstInGroup && !isLastInGroup && "rounded-bl-md",
                                    !isFirstInGroup && isLastInGroup && "rounded-tl-md rounded-bl-md",
                                    !isFirstInGroup && !isLastInGroup && "rounded-l-md",
                                  ),
                            )}
                          >
                            <p className="text-[14px] leading-relaxed">{msg.content}</p>
                            <div
                              className={cn(
                                "mt-1 flex items-center justify-end gap-1 text-[10px]",
                                isOwn ? "text-white/60" : "text-muted-foreground",
                              )}
                            >
                              <span>{msg.timestamp}</span>
                              {isOwn && (
                                msg.isRead
                                  ? <CheckCheck className="h-3 w-3" />
                                  : <Check className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Input Area - iMessage style */}
                <div className="border-t border-border bg-background px-4 py-3">
                  <div className="mx-auto flex max-w-2xl items-end gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 rounded-full text-primary hover:bg-accent">
                      <Plus className="h-5 w-5" />
                    </Button>
                    <div className="relative flex-1">
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
                        className="rounded-full border-border bg-muted/40 pr-10 text-sm focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      size="icon"
                      className={cn(
                        "h-9 w-9 flex-shrink-0 rounded-full transition-colors",
                        newMessage.trim()
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground",
                      )}
                      onClick={handleSend}
                      disabled={!newMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              /* Empty State */
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
