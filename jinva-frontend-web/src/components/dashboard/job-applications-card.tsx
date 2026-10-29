"use client"

import { useEffect, useState } from "react"
import { Inbox, Loader2, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiFetch } from "@/lib/api"
import { formatCurrency, resolveAvatarUrl } from "@/lib/utils"

interface Application {
  id: number
  quotePrice?: number | string | null
  message?: string | null
  status: "PENDING" | "ACCEPTED" | "REJECTED"
  createdAt: string
  artisan: { id: number; firstname?: string; lastname?: string; profilePicture?: string | null }
}

const nameOf = (a: Application) =>
  `${a.artisan.firstname ?? ""} ${a.artisan.lastname ?? ""}`.trim() || "Artisan"

/**
 * QA JOB-09: customers could not see or accept applications on the web, so a
 * posted job could never move past OPEN. Lists the job's applications and lets
 * the customer accept one; accepting creates the payment they then pay.
 */
export function JobApplicationsCard({
  jobId,
  onAccepted,
}: {
  jobId: string | number
  onAccepted: () => void
}) {
  const [applications, setApplications] = useState<Application[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [confirming, setConfirming] = useState<Application | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    apiFetch<Application[]>(`/jobs/${jobId}/applications`)
      .then((list) => setApplications(list))
      .catch(() => setLoadFailed(true))
  }, [jobId])

  const accept = async () => {
    if (!confirming) return
    setIsAccepting(true)
    try {
      await apiFetch(`/jobs/${jobId}/applications/${confirming.id}/accept`, { method: "POST" })
      toast.success(`You accepted ${nameOf(confirming)}. Pay now to secure the job.`)
      setConfirming(null)
      onAccepted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't accept this application.")
    } finally {
      setIsAccepting(false)
    }
  }

  const pending = applications?.filter((a) => a.status === "PENDING") ?? []

  return (
    <Card>
      <div className="border-b border-border p-5">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <Inbox className="h-4 w-4 text-primary" />
          Applications{applications ? ` (${pending.length})` : ""}
        </h3>
      </div>
      <CardContent className="space-y-3 p-5">
        {applications === null && !loadFailed && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading applications…
          </div>
        )}
        {loadFailed && <p className="text-sm text-muted-foreground">Couldn&apos;t load applications. Refresh to try again.</p>}
        {applications !== null && pending.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No applications yet. Artisans who apply will appear here with their price.
          </p>
        )}
        {pending.map((a) => (
          <div key={a.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={resolveAvatarUrl(a.artisan.profilePicture)} />
                <AvatarFallback>
                  <UserRound className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{nameOf(a)}</p>
                <p className="text-xs text-muted-foreground">
                  Applied {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              </div>
              <p className="font-semibold text-foreground">
                {a.quotePrice != null && Number(a.quotePrice) > 0 ? formatCurrency(Number(a.quotePrice)) : "No price"}
              </p>
            </div>
            {a.message && <p className="whitespace-pre-line text-sm text-muted-foreground">{a.message}</p>}
            <Button
              size="sm"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setConfirming(a)}
            >
              Accept
            </Button>
          </div>
        ))}
      </CardContent>

      <AlertDialog open={confirming != null} onOpenChange={(open) => !open && !isAccepting && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept {confirming ? nameOf(confirming) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.quotePrice != null && Number(confirming.quotePrice) > 0
                ? `You'll pay ${formatCurrency(Number(confirming.quotePrice))}, held safely until you confirm the job is done. `
                : ""}
              The other applicants will be told this job is taken.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAccepting}>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void accept()
              }}
              disabled={isAccepting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
