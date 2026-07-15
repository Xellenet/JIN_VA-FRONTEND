"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronRight, Clock, ArrowUpRight, UserRound } from "lucide-react"
import { naviiAvatar } from "@/lib/utils"
import type { Activity } from "@/lib/types"

interface RecentActivitiesProps {
  activities: Activity[]
}

const statusConfig = {
  "in-progress": { 
    label: "In Progress", 
    className: "bg-primary/10 text-primary border-primary/20",
    dotColor: "bg-primary"
  },
  completed: { 
    label: "Completed", 
    className: "bg-green-50 text-green-700 border-green-200",
    dotColor: "bg-green-500"
  },
  cancelled: { 
    label: "Cancelled", 
    className: "bg-red-50 text-red-700 border-red-200",
    dotColor: "bg-red-500"
  },
  pending: { 
    label: "Pending", 
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dotColor: "bg-amber-500"
  },
}

export function RecentActivities({ activities }: RecentActivitiesProps) {
  const [filter, setFilter] = useState<string>("all")

  const filteredActivities = filter === "all" 
    ? activities 
    : activities.filter(a => a.status === filter)

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold">Recent Activities</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <div className="space-y-1">
          {filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No activities found</p>
            </div>
          ) : (
            filteredActivities.map((activity, index) => (
              <div
                key={activity.id}
                className="group relative flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
              >
                {/* Timeline connector */}
                {index < filteredActivities.length - 1 && (
                  <div className="absolute left-[27px] top-[52px] h-[calc(100%-20px)] w-px bg-border" />
                )}
                
                {/* Avatar with status indicator */}
                <div className="relative flex-shrink-0">
                  <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                    <AvatarImage src={activity.clientAvatar || naviiAvatar(activity.clientName)} />
                    <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <span 
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${statusConfig[activity.status].dotColor}`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{activity.clientName}</p>
                    <Badge 
                      variant="outline" 
                      className={`${statusConfig[activity.status].className} text-[10px] px-1.5 py-0 h-5 font-medium`}
                    >
                      {statusConfig[activity.status].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {activity.serviceName}
                  </p>
                </div>

                {/* Time and Action */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {activity.time}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* See All Link */}
        {filteredActivities.length > 0 && (
          <Button 
            variant="ghost" 
            className="w-full mt-3 h-9 text-xs text-muted-foreground hover:text-foreground"
          >
            View all activities
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
