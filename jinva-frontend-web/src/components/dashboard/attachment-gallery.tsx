"use client"

import { useState } from "react"
import { ImageOff } from "lucide-react"
import { resolveMediaUrl } from "@/lib/utils"
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
        {attachments.map((att) => {
          const resolved = resolveMediaUrl(att.url)
          return (
            <button
              key={att.id}
              type="button"
              onClick={() => setPreviewUrl(resolved)}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`View attached photo ${att.id}`}
            >
              {resolved ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolved}
                  alt="Job attachment"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageOff className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </button>
          )
        })}
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
