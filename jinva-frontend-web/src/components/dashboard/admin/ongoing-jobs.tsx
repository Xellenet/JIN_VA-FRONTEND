import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, UserRound } from "lucide-react"
import { resolveAvatarUrl } from "@/lib/utils"
import { getJobStatusConfig } from "@/lib/status-badges"

export interface OngoingJob {
  id: number
  title: string
  service: string | null
  status: string
  deadline: string | null
  customerName: string
  customerPicture: string | null
}

/**
 * QA ADM-02: jobs in progress, from `GET /admin/jobs`. It used to show
 * made-up rows.
 */
export function OngoingJobs({ jobs }: { jobs: OngoingJob[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Ongoing Jobs</CardTitle>
          <Button variant="link" size="sm" className="h-8" asChild>
            <Link href="/dashboard/admin/orders">See All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No jobs in progress right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Client</th>
                  <th className="pb-3 font-medium">Job</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const cfg = getJobStatusConfig(job.status)
                  return (
                    <tr key={job.id} className="border-b last:border-0">
                      <td className="py-4 pr-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={resolveAvatarUrl(job.customerPicture)} />
                            <AvatarFallback>
                              <UserRound className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{job.customerName}</span>
                        </div>
                      </td>
                      <td className="py-4 pr-3">
                        <p className="text-sm">{job.title}</p>
                        {job.service && <p className="text-xs text-muted-foreground">{job.service}</p>}
                      </td>
                      <td className="py-4 pr-3">
                        <Badge variant="outline" className={cfg.className}>
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">
                        {job.deadline ? (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(job.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
