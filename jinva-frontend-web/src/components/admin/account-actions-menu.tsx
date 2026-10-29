"use client"

import { useState } from "react"
import { Loader2, MoreVertical } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

export type AccountStatus = "ACTIVE" | "SUSPENDED" | "BANNED"

const SUSPEND_REASON_MIN = 10
const REASON_MAX = 1000

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const style =
    status === "ACTIVE"
      ? "border-success/20 bg-success/10 text-success"
      : status === "SUSPENDED"
        ? "border-warning/20 bg-warning/10 text-warning"
        : "border-destructive/20 bg-destructive/10 text-destructive"
  return (
    <Badge variant="outline" className={style}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {status === "ACTIVE" ? "Active" : status === "SUSPENDED" ? "Suspended" : "Banned"}
    </Badge>
  )
}

type Action = "ban" | "suspend"

/**
 * QA ADM-04 / ADM-06: ban, unban, suspend and activate from the admin lists.
 * Suspending (reversible; the person can still sign in but can't transact or
 * appear in search) needs a reason for the audit log; banning asks first and
 * takes an optional one. Unban and activate restore access directly.
 */
export function AccountActionsMenu({
  userId,
  name,
  status,
  onChanged,
}: {
  userId: number | string
  name: string
  status: AccountStatus
  onChanged: (status: AccountStatus) => void
}) {
  const [pending, setPending] = useState(false)
  const [dialog, setDialog] = useState<Action | null>(null)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)

  const run = async (action: "ban" | "unban" | "suspend" | "activate", body?: object) => {
    setPending(true)
    try {
      await apiFetch(`/admin/users/${userId}/${action}`, {
        method: "PATCH",
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const next: AccountStatus = action === "ban" ? "BANNED" : action === "suspend" ? "SUSPENDED" : "ACTIVE"
      onChanged(next)
      setDialog(null)
      toast.success(
        action === "ban"
          ? `${name} has been banned.`
          : action === "suspend"
            ? `${name} has been suspended.`
            : `${name} can use JinVa again.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Please try again.")
    } finally {
      setPending(false)
    }
  }

  const open = (action: Action) => {
    setReason("")
    setReasonError(null)
    setDialog(action)
  }

  const confirm = () => {
    const text = reason.trim()
    if (dialog === "suspend" && text.length < SUSPEND_REASON_MIN) {
      setReasonError(`Give a reason of at least ${SUSPEND_REASON_MIN} characters.`)
      document.getElementById("account-action-reason")?.focus()
      return
    }
    void run(dialog!, text ? { reason: text } : undefined)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending} aria-label={`Actions for ${name}`}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "ACTIVE" && <DropdownMenuItem onClick={() => open("suspend")}>Suspend User</DropdownMenuItem>}
          {status === "SUSPENDED" && (
            <DropdownMenuItem className="text-success" onClick={() => void run("activate")}>
              Activate User
            </DropdownMenuItem>
          )}
          {status !== "BANNED" && <DropdownMenuSeparator />}
          {status === "BANNED" ? (
            <DropdownMenuItem className="text-success" onClick={() => void run("unban")}>
              Unban User
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="text-destructive" onClick={() => open("ban")}>
              Ban User
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={dialog != null} onOpenChange={(o) => !o && !pending && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === "ban" ? `Ban ${name}?` : `Suspend ${name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "ban"
                ? "They will be signed out everywhere and won't be able to sign in until you unban them."
                : "They can still sign in, but can't book, post jobs, apply or message, and won't appear in search until you activate them."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="account-action-reason">
              Reason{dialog === "ban" ? " (optional)" : ""}
            </Label>
            <Textarea
              id="account-action-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setReasonError(null)
              }}
              maxLength={REASON_MAX}
              rows={3}
              aria-invalid={reasonError != null}
              aria-describedby={reasonError ? "account-action-reason-error" : undefined}
              disabled={pending}
            />
            {reasonError ? (
              <p id="account-action-reason-error" className="text-sm text-destructive">
                {reasonError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Kept in the admin action log.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep access</AlertDialogCancel>
            <AlertDialogAction
              className={
                dialog === "ban"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }
              onClick={(e) => {
                e.preventDefault()
                confirm()
              }}
              disabled={pending}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog === "ban" ? "Ban user" : "Suspend user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
