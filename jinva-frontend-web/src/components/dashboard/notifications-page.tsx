"use client"

import React from "react"
import { useState } from "react"
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
  Trash2,
  ArrowLeft,
} from "lucide-react"
import { mockNotifications } from "@/lib/data/mock-data"
import type { User, Notification } from "@/lib/types"
import { cn } from "@/lib/utils"

interface NotificationsPageProps {
  user: User
}

const typeConfig: Record<
  Notification["type"],
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  booking: { icon: Calendar, color: "text-foreground", bg: "bg-muted", label: "Booking" },
  payment: { icon: CreditCard, color: "text-green-600", bg: "bg-green-100", label: "Payment" },
  review: { icon: Star, color: "text-yellow-600", bg: "bg-yellow-100", label: "Review" },
  assignment: { icon: Briefcase, color: "text-blue-600", bg: "bg-blue-100", label: "Assignment" },
  message: { icon: MessageSquare, color: "text-violet-600", bg: "bg-violet-100", label: "Message" },
  system: { icon: Settings, color: "text-muted-foreground", bg: "bg-muted", label: "System" },
}

const notificationDetails: Record<string, { description: string; action?: string }> = {
  n1: {
    description: "Devon Lane has submitted a new booking request for Emergency Leak Repair service. The service is scheduled for the earliest available time slot. Please review the booking details and confirm availability.",
    action: "View Booking",
  },
  n2: {
    description: "A payment of $120.00 has been successfully received for order #o1 (Emergency Leak Repair). The funds have been processed and will be available in your account within 1-2 business days.",
    action: "View Payment",
  },
  n3: {
    description: "Kristin Watson has left a 5-star review on your profile after the completed Pipe Installation service. The review highlights your professionalism and quality of work.",
    action: "View Review",
  },
  n4: {
    description: "You have been assigned to a new Pipe Installation job for Jane Cooper at 456 Maple Ave, Shelbyville. The job is scheduled and all details have been added to your calendar.",
    action: "View Assignment",
  },
  n5: {
    description: "Jacob Jones sent you a message regarding a re-piping project for his basement. He is looking for a quote and availability for the next two weeks.",
    action: "View Message",
  },
  n6: {
    description: "Your booking for Water Heater Maintenance has been confirmed and scheduled. The artisan has been notified and will arrive at the scheduled time.",
    action: "View Booking",
  },
  n7: {
    description: "The Plumbify platform will undergo scheduled maintenance on February 15th from 2:00 AM to 4:00 AM EST. During this time, some features may be temporarily unavailable. We apologize for any inconvenience.",
  },
  n8: {
    description: "A refund of $90.00 has been processed for order #o3 (Water Heater Maintenance) due to the cancelled booking. The refund will appear on your original payment method within 5-10 business days.",
    action: "View Payment",
  },
  n9: {
    description: "Robert Fox has marked the Emergency Leak Repair job as completed. The work included replacing corroded joints and re-sealing all connections. You can now leave a review for the service.",
    action: "Leave Review",
  },
  n10: {
    description: "Wade Warren has left a 4-star review on your profile after the completed Bathroom Fixture Installation service. Check your reviews section for the full feedback.",
    action: "View Review",
  },
}

export function NotificationsPage({ user }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const displayed = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
  }

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (selectedNotification?.id === id) {
      setSelectedNotification(null)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    markRead(notification.id)
    setSelectedNotification(notification)
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
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

        {/* Notification List */}
        <Card>
          <CardContent className="p-0">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Bell className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">
                  {filter === "unread" ? "No unread notifications" : "No notifications"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filter === "unread" ? "All caught up. Switch to All to see past notifications." : "Notifications about your activity will appear here."}
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
                            {notification.type}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNotification(notification.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notification Detail Dialog */}
      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedNotification && (() => {
            const config = typeConfig[selectedNotification.type]
            const Icon = config.icon
            const details = notificationDetails[selectedNotification.id]
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
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{selectedNotification.time}</span>
                      </div>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm leading-relaxed text-foreground">
                      {details?.description || selectedNotification.message}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs font-medium text-muted-foreground">Summary</p>
                    <p className="mt-1 text-sm text-foreground">{selectedNotification.message}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
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
