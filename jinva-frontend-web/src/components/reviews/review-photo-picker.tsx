"use client"

import { useRef, useState } from "react"
import { AlertTriangle, ImageIcon, Loader2, X } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { resolveMediaUrl } from "@/lib/utils"
import { toast } from "sonner"

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png"]
const MAX_PHOTOS = 3
const MAX_SIZE_BYTES = 5 * 1024 * 1024

type TileState = "empty" | "uploading" | "done" | "failed"

interface Tile {
  state: TileState
  previewUrl?: string
  url?: string
  file?: File
  errorMessage?: string
}

const EMPTY_TILE: Tile = { state: "empty" }

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Only JPEG or PNG photos are supported."
  if (file.size > MAX_SIZE_BYTES) return "Photo exceeds the 5MB size limit."
  return null
}

/**
 * design-spec.md §5.4 (RP1) — three fixed tiles, optimistic local preview,
 * per-tile uploading/failure states, "+ Add Photo" empty state, always-visible
 * remove-X (same discoverability principle as the redesigned favourites
 * unfavourite control — never hover-gated). Uploads via
 * `POST /uploads/review-photo` (api-contract.md §5) and hands the resulting
 * URLs back to the caller for `POST /reviews`'s `photoUrls`.
 */
export function ReviewPhotoPicker({
  value,
  onChange,
  disabled,
}: Readonly<{ value: string[]; onChange: (urls: string[]) => void; disabled?: boolean }>) {
  const [tiles, setTiles] = useState<Tile[]>([EMPTY_TILE, EMPTY_TILE, EMPTY_TILE])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const syncUrls = (next: Tile[]) => {
    onChange(next.filter((t) => t.state === "done" && t.url).map((t) => t.url!))
  }

  const uploadAt = async (slot: number, file: File) => {
    const err = validateFile(file)
    const previewUrl = URL.createObjectURL(file)

    if (err) {
      toast.error(err)
      setTiles((prev) => {
        const next = [...prev]
        next[slot] = { state: "failed", errorMessage: err, file }
        return next
      })
      return
    }

    setTiles((prev) => {
      const next = [...prev]
      next[slot] = { state: "uploading", previewUrl, file }
      return next
    })

    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await apiFetch<{ url: string }>("/uploads/review-photo", {
        method: "POST",
        body: formData,
      })
      setTiles((prev) => {
        const next = [...prev]
        next[slot] = { state: "done", previewUrl, url: res.url, file }
        syncUrls(next)
        return next
      })
    } catch (e) {
      setTiles((prev) => {
        const next = [...prev]
        next[slot] = {
          state: "failed",
          previewUrl,
          file,
          errorMessage: e instanceof Error ? e.message : "Upload failed.",
        }
        return next
      })
    }
  }

  const handlePick = (slot: number, files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (MAX_PHOTOS <= value.length && tiles[slot].state !== "done" && tiles[slot].state !== "failed") {
      toast.error(`You can attach up to ${MAX_PHOTOS} photos.`)
      return
    }
    uploadAt(slot, file)
  }

  const removeAt = (slot: number) => {
    setTiles((prev) => {
      const next = [...prev]
      next[slot] = EMPTY_TILE
      syncUrls(next)
      return next
    })
    if (inputRefs.current[slot]) inputRefs.current[slot]!.value = ""
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile, i) => (
          <div key={`review-photo-slot-${i}`} className="relative aspect-square">
            <input
              ref={(el) => { inputRefs.current[i] = el }}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              disabled={disabled}
              onChange={(e) => handlePick(i, e.target.files)}
            />

            {tile.state === "empty" && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRefs.current[i]?.click()}
                className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-xs font-medium">Add Photo</span>
              </button>
            )}

            {tile.state === "failed" && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRefs.current[i]?.click()}
                className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-destructive/40 bg-destructive/5 p-1.5 text-center text-destructive"
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="text-[10px] font-medium leading-tight">
                  {tile.errorMessage ?? "Couldn't upload"} — tap to retry
                </span>
              </button>
            )}

            {(tile.state === "uploading" || tile.state === "done") && (
              <div className="h-full w-full overflow-hidden rounded-lg border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.state === "done" && tile.url ? resolveMediaUrl(tile.url) : tile.previewUrl}
                  alt="Selected review photo"
                  className="h-full w-full object-cover"
                />
                {tile.state === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-foreground/40">
                    <Loader2 className="h-5 w-5 animate-spin text-background" />
                  </div>
                )}
              </div>
            )}

            {(tile.state === "done" || tile.state === "uploading") && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeAt(i)}
                aria-label="Remove photo"
                title="Remove photo"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-foreground/80 text-background shadow-sm hover:bg-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Up to 3 photos · JPEG or PNG · 5MB each</p>
    </div>
  )
}
