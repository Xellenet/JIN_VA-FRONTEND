"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Clock, UserRound, Briefcase, CalendarDays } from "lucide-react"
import { resolveAvatarUrl } from "@/lib/utils"
import { getBookingStatusConfig, getJobStatusConfig } from "@/lib/status-badges"
export interface Activity {
  kind: "booking" | "job"
  id: number
  title: string
  status: string
  at: string
  customerName: string
  customerPicture: string | null
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

/**
 * QA ADM-02: the newest bookings and posted jobs, from `GET /admin/bookings`
 * and `GET /admin/jobs`.
 * It used to list four made-up people.
 */
export function RecentActivities({ activities }: { activities: Activity[] }) {
  const [filter, setFilter] = useState<"all" | "booking" | "job">("all")
  const shown = filter === "all" ? activities : activities.filter((a) => a.kind === filter)

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everything</SelectItem>
              <SelectItem value="booking">Bookings</SelectItem>
              <SelectItem value="job">Posted jobs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 rounded-full bg-muted p-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Nothing yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {shown.map((a) => {
              const cfg = a.kind === "booking" ? getBookingStatusConfig(a.status) : getJobStatusConfig(a.status)
              const Icon = a.kind === "booking" ? CalendarDays : Briefcase
              return (
                <div key={`${a.kind}-${a.id}`} className="flex items-center gap-3 rounded-lg p-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={resolveAvatarUrl(a.customerPicture)} />
                    <AvatarFallback>
                      <UserRound className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{a.customerName}</p>
                      <Badge variant="outline" className={`${cfg.className} h-5 px-1.5 py-0 text-[10px] font-medium`}>
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Icon className="h-3 w-3 shrink-0" />
                      {a.title}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">{timeAgo(a.at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
