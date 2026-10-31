"use client"

import { useRef, useState } from "react"
import { AlertTriangle, Camera, ChevronRight, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { removeProfilePhoto } from "@/lib/customer-api"
import { cn } from "@/lib/utils"
import type { User } from "@/lib/types"

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const HINT = "Choose a JPEG, PNG or WebP photo up to 5 MB."

type UploadError = { title: string; body: string }

function initialsOf(user: Pick<User, "name" | "firstname" | "lastname">): string {
  const first = user.firstname?.trim() || user.name.trim().split(/\s+/)[0] || ""
  const last = user.lastname?.trim() || user.name.trim().split(/\s+/).slice(1).join(" ") || ""
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?"
}

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-ring"

/**
 * Settings → Profile → Profile photo (item 3).
 *
 * Below 640px the card stacks and centres (avatar, name, email, full-width
 * 44px buttons); from 640px it keeps the avatar-left layout with a shrinkable
 * text column and wrapping buttons. Remove is real now (`DELETE
 * /users/me/avatar`) and appears only when there is a photo. Upload errors
 * show inline, not only as a toast.
 */
export function ProfilePhotoCard({ user, refreshUser }: Readonly<{ user: User; refreshUser: () => Promise<void> }>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [uploadError, setUploadError] = useState<UploadError | null>(null)
  const hasPhoto = !!user.avatar
  const initials = initialsOf(user)
  const busy = isUploading || isRemoving

  const pickFile = () => {
    if (!busy) inputRef.current?.click()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      setUploadError({ title: "This file type isn’t supported", body: HINT })
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError({ title: "This file is larger than 5 MB", body: HINT })
      return
    }
    setUploadError(null)
    const formData = new FormData()
    formData.append("avatar", file)
    setIsUploading(true)
    try {
      await apiFetch("/users/me/avatar", { method: "POST", body: formData })
      await refreshUser()
      toast.success("Photo updated")
    } catch (err) {
      setUploadError({
        title: err instanceof Error && err.message ? err.message : "Couldn’t upload your photo",
        body: HINT,
      })
    } finally {
      setIsUploading(false)
    }
  }

  const remove = async () => {
    setIsRemoving(true)
    try {
      await removeProfilePhoto()
      await refreshUser()
      toast.success("Photo removed")
    } catch {
      toast.error("Couldn’t remove your photo", {
        action: { label: "Try again", onClick: () => void remove() },
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Card className="gap-0 py-0">
      <div className="border-b p-4 sm:p-6">
        <h3 className="font-semibold">Profile photo</h3>
        <p className="text-sm text-muted-foreground">Artisans see this on your jobs and messages.</p>
      </div>
      <div className="p-4 sm:p-6">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleFile}
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left">
          <div className="relative shrink-0">
            <Avatar className={cn("h-24 w-24 transition-opacity", isUploading && "opacity-50")}>
              <AvatarImage src={user.avatar || undefined} alt="" />
              <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            {isUploading && (
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <span className="absolute inset-1 rounded-full border-[3px] border-primary/25 border-t-primary animate-spin motion-reduce:animate-none" />
              </span>
            )}
            <button
              type="button"
              onClick={pickFile}
              disabled={busy}
              aria-label="Change profile photo"
              className={cn(
                "absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full disabled:cursor-not-allowed",
                FOCUS_RING,
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-foreground text-background">
                <Camera className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>

          <div className="w-full min-w-0 sm:flex-1">
            <p dir="auto" className="font-semibold text-foreground [overflow-wrap:anywhere] [unicode-bidi:isolate] sm:truncate" title={user.name}>
              {user.name}
            </p>
            <p
              dir="auto"
              title={user.email}
              className="text-sm text-muted-foreground [overflow-wrap:anywhere] [unicode-bidi:isolate] sm:truncate"
            >
              {user.email}
            </p>
            <div className="mt-4 flex w-full flex-col gap-2 sm:mt-3 sm:flex-row sm:flex-wrap">
              <Button className="h-11 w-full sm:h-8 sm:w-auto" size="sm" onClick={pickFile} disabled={busy}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Upload new photo
                  </>
                )}
              </Button>
              {hasPhoto && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 w-full sm:h-8 sm:w-auto"
                  onClick={() => setConfirmOpen(true)}
                  disabled={busy}
                >
                  {isRemoving ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  Remove photo
                </Button>
              )}
            </div>
          </div>
        </div>

        {uploadError && (
          <div
            role="alert"
            className="mt-4 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 text-left sm:ml-[120px]"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive">{uploadError.title}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{uploadError.body}</p>
            </div>
          </div>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground sm:ml-[120px] sm:text-left">
          JPEG, PNG or WebP, up to 5 MB.
        </p>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="sm:max-w-sm">
          <div className="flex items-center gap-4" aria-hidden="true">
            <Avatar className="h-12 w-12 border">
              <AvatarImage src={user.avatar || undefined} alt="" />
              <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials}
            </span>
          </div>
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>Remove your profile photo?</AlertDialogTitle>
            <AlertDialogDescription>Artisans will see your initials instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="max-sm:h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 max-sm:h-11"
              onClick={() => void remove()}
            >
              Remove photo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
