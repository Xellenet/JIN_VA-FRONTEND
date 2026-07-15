"use client"

import React, { useState, useEffect } from "react"
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
import {
  Calendar,
  CreditCard,
  Star,
  Briefcase,
  MessageSquare,
  Settings,
  Bell,
  Check,
  CheckCheck,
  Loader2,
} from "lucide-react"
import type { Notification } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"

interface BackendNotification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  payload?: unknown
  createdAt: string
}

function mapNotificationType(type: string): Notification["type"] {
  const t = type.toUpperCase()
  if (t.includes("PAYMENT") || t.includes("REFUND")) return "payment"
  if (t.includes("REVIEW")) return "review"
  if (t.includes("MESSAGE")) return "message"
  if (t.includes("BOOKING")) return "booking"
  if (t.includes("JOB") || t.includes("ASSIGN")) return "assignment"
  return "system"
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function mapNotification(n: BackendNotification): Notification {
  return {
    id: n.id,
    title: n.title,
    message: n.body,
    type: mapNotificationType(n.type),
    isRead: n.isRead,
    time: formatTime(n.createdAt),
  }
}

const typeConfig: Record<
  Notification["type"],
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  booking:    { icon: Calendar,       color: "text-foreground",       bg: "bg-muted",       label: "Booking" },
  payment:    { icon: CreditCard,     color: "text-primary",          bg: "bg-primary/10",  label: "Payment" },
  review:     { icon: Star,           color: "text-yellow-600",       bg: "bg-yellow-100",  label: "Review" },
  assignment: { icon: Briefcase,      color: "text-blue-600",         bg: "bg-blue-100",    label: "Assignment" },
  message:    { icon: MessageSquare,  color: "text-violet-600",       bg: "bg-violet-100",  label: "Message" },
  system:     { icon: Settings,       color: "text-muted-foreground", bg: "bg-muted",       label: "System" },
}

export function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)

  useEffect(() => {
    apiFetch<BackendNotification[] | { items: BackendNotification[] }>("/notifications?page=1&limit=50")
      .then((r) => {
        const items = Array.isArray(r) ? r : (r as { items: BackendNotification[] }).items ?? []
        setNotifications(items.map(mapNotification))
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  if (!user) return null

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const displayed = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications

  const markAllRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    }
  }

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notifications</p>
            <h1 className="mt-0.5 text-2xl font-bold text-foreground">Activity Feed</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "You're all caught up"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className={filter === "all" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-transparent"}
            >
              All ({notifications.length})
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("unread")}
              className={filter === "unread" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-transparent"}
            >
              Unread ({unreadCount})
            </Button>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="text-primary hover:text-primary/80">
                <CheckCheck className="mr-1.5 h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <Card>
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
                  const config = typeConfig[notification.type]
                  const Icon = config.icon
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50",
                        !notification.isRead && "bg-accent/50",
                      )}
                    >
                      <div className={cn("mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full", config.bg)}>
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
                            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{notification.time}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              markRead(notification.id)
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedNotification && (() => {
            const config = typeConfig[selectedNotification.type]
            const Icon = config.icon
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full", config.bg)}>
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <div>
                      <DialogTitle className="text-left">{selectedNotification.title}</DialogTitle>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{config.label}</Badge>
                        <span className="text-xs text-muted-foreground">{selectedNotification.time}</span>
                      </div>
                    </div>
                  </div>
                </DialogHeader>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm leading-relaxed text-foreground">{selectedNotification.message}</p>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" className="bg-transparent" onClick={() => setSelectedNotification(null)}>
                    Close
                  </Button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
