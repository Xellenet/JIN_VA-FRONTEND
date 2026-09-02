import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, UserRound } from "lucide-react"
import { resolveAvatarUrl } from "@/lib/utils"
import type { Order } from "@/lib/types"

interface OngoingJobsProps {
  jobs: Order[]
}

const statusConfig = {
  "in-progress": { label: "In Progress", className: "bg-muted text-muted-foreground border-muted" },
  completed: { label: "Completed", className: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  available: { label: "Available", className: "bg-info/10 text-info border-info/20" },
}

export function OngoingJobs({ jobs }: OngoingJobsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Ongoing Jobs</CardTitle>
          <Button variant="link" size="sm" className="h-8">
            See All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium">Service</th>
                <th className="pb-3 font-medium">Artisan</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b last:border-0">
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={resolveAvatarUrl(job.clientAvatar, job.clientName)} />
                        <AvatarFallback><UserRound className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{job.clientName}</span>
                    </div>
                  </td>
                  <td className="py-4 text-sm">{job.serviceName}</td>
                  <td className="py-4 text-sm">{job.artisanName}</td>
                  <td className="py-4">
                    <Badge variant="outline" className={statusConfig[job.status].className}>
                      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"></span>
                      {statusConfig[job.status].label}
                    </Badge>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {job.deadline}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
