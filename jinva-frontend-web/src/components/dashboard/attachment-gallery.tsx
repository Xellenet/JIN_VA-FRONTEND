"use client"

import { useState } from "react"
import { ImageOff, Loader2 } from "lucide-react"
import { usePrivateMedia } from "@/hooks/use-private-media"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

export interface JobAttachment {
  id: number
  url: string
  fileType: string
  createdAt: string
}

/**
 * QA MSG-18: job photos are private to the people on the job, so each one is
 * loaded with the signed-in request (`usePrivateMedia`), not a plain URL.
 */
function AttachmentThumb({
  attachment,
  onOpen,
}: {
  attachment: JobAttachment
  onOpen: (src: string) => void
}) {
  const { src, status } = usePrivateMedia(attachment.url)
  return (
    <button
      type="button"
      onClick={() => src && onOpen(src)}
      disabled={!src}
      className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={src ? `View attached photo ${attachment.id}` : "Photo unavailable"}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Job attachment"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {status === "loading" ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <ImageOff className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      )}
    </button>
  )
}

/**
 * J4: renders a job's photo attachments as a gallery/thumbnail strip.
 * Shared between the customer and artisan job-detail pages so both parties
 * see the identical set of photos.
 */
export function AttachmentGallery({ attachments }: { readonly attachments: JobAttachment[] | undefined }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  if (!attachments || attachments.length === 0) return null

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {attachments.map((att) => (
          <AttachmentThumb key={att.id} attachment={att} onOpen={setPreviewUrl} />
        ))}
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogTitle className="sr-only">Job attachment preview</DialogTitle>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Job attachment full size" className="max-h-[70vh] w-full rounded-md object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
