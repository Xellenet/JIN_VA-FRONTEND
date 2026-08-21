"use client"

import { useRef, useState } from "react"
import { Loader2, Paperclip, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { resolveMediaUrl } from "@/lib/utils"
import { toast } from "sonner"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE_BYTES = 10 * 1024 * 1024
const MAX_FILES = 10

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Unsupported file type. Please upload a JPEG, PNG, or WebP image."
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "File exceeds the 10MB size limit."
  }
  return null
}

interface UploadedAttachment {
  url: string
  name: string
}

/**
 * J4: client-side counterpart of `POST /uploads/job-attachment` — uploads
 * each selected photo individually (mirroring the existing avatar/portfolio
 * upload abstraction) and hands the resulting URLs back to the caller for
 * inclusion in `attachmentUrls` on job/booking creation. Client-side
 * type/size validation mirrors the server's own (JPEG/PNG/WebP, ≤10MB, max 10
 * files) so obviously-invalid files never round-trip to the server.
 */
export function AttachmentUploader({
  value,
  onChange,
  disabled,
}: {
  readonly value: string[]
  readonly onChange: (urls: string[]) => void
  readonly disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [items, setItems] = useState<UploadedAttachment[]>([])

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const remaining = MAX_FILES - value.length
    if (remaining <= 0) {
      toast.error(`You can attach at most ${MAX_FILES} photos.`)
      return
    }
    const toUpload = Array.from(files).slice(0, remaining)

    setIsUploading(true)
    const newUrls: string[] = []
    const newItems: UploadedAttachment[] = []
    for (const file of toUpload) {
      const err = validateFile(file)
      if (err) {
        toast.error(`${file.name}: ${err}`)
        continue
      }
      try {
        const formData = new FormData()
        formData.append("file", file)
        const res = await apiFetch<{ url: string }>("/uploads/job-attachment", {
          method: "POST",
          body: formData,
        })
        newUrls.push(res.url)
        newItems.push({ url: res.url, name: file.name })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Failed to upload ${file.name}.`)
      }
    }
    if (newUrls.length > 0) {
      onChange([...value, ...newUrls])
      setItems((prev) => [...prev, ...newItems])
    }
    setIsUploading(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  const removeAt = (url: string) => {
    onChange(value.filter((u) => u !== url))
    setItems((prev) => prev.filter((i) => i.url !== url))
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || isUploading}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 bg-transparent"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading || value.length >= MAX_FILES}
      >
        {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        Attach photos
      </Button>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, or WebP · max 10MB each · up to {MAX_FILES} photos (optional)
      </p>

      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item.url}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs"
            >
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveMediaUrl(item.url)} alt="" className="h-6 w-6 rounded object-cover" />
              <span className="max-w-[120px] truncate">{item.name}</span>
              <button
                type="button"
                onClick={() => removeAt(item.url)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${item.name}`}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
