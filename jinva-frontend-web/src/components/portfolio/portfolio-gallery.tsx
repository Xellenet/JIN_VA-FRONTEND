"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ImageIcon, Loader2, AlertTriangle, Video, X, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react"
import { resolveMediaUrl } from "@/lib/utils"
import type { ApiPortfolioItem } from "@/lib/types"

function isVideo(item: ApiPortfolioItem) {
  return item.fileType?.startsWith("video/")
}

interface PortfolioGalleryProps {
  items: ApiPortfolioItem[]
  isLoading: boolean
  error: boolean
}

export function PortfolioGallery({ items, isLoading, error }: PortfolioGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null)
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i === null ? i : Math.min(i + 1, items.length - 1)))
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i === null ? i : Math.max(i - 1, 0)))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightboxIndex, items.length])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading portfolio…</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-destructive/60" />
          <h3 className="text-lg font-semibold text-foreground">Couldn&apos;t load portfolio</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong fetching this artisan&apos;s work. Please try again later.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-foreground">No portfolio items yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This artisan hasn&apos;t added any portfolio items yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  const active = lightboxIndex !== null ? items[lightboxIndex] : null

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
        {items.map((item, index) => {
          const url = resolveMediaUrl(item.fileUrl)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="group relative block w-full break-inside-avoid overflow-hidden rounded-lg border border-border bg-muted text-left"
            >
              {isVideo(item) ? (
                <div className="relative flex aspect-video w-full items-center justify-center bg-foreground/5">
                  <video src={url} className="h-full w-full object-cover" muted preload="metadata" />
                  <PlayCircle className="absolute h-10 w-10 text-background drop-shadow" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={item.caption || item.tag || "Portfolio item"}
                  className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              )}
              {(item.caption || item.tag) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 to-transparent p-3">
                  {item.tag && <Badge className="mb-1 bg-background/90 text-foreground">{item.tag}</Badge>}
                  {item.caption && <p className="line-clamp-1 text-xs text-background">{item.caption}</p>}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4"
          onClick={() => setLightboxIndex(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setLightboxIndex(null) }}
          role="dialog"
          aria-modal="true"
          aria-label={active.caption || "Portfolio preview"}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={() => {}}
            role="document"
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute -right-2 -top-12 z-10 h-9 w-9 rounded-full bg-background/90 shadow-md hover:bg-background"
              onClick={() => setLightboxIndex(null)}
            >
              <X className="h-4 w-4" />
            </Button>

            {lightboxIndex! > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute -left-4 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-background/90 shadow-md hover:bg-background sm:-left-14"
                onClick={() => setLightboxIndex((i) => (i === null ? i : Math.max(i - 1, 0)))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {lightboxIndex! < items.length - 1 && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute -right-4 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-background/90 shadow-md hover:bg-background sm:-right-14"
                onClick={() => setLightboxIndex((i) => (i === null ? i : Math.min(i + 1, items.length - 1)))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}

            <div className="overflow-hidden rounded-lg bg-background shadow-2xl">
              <div className="relative flex max-h-[75vh] items-center justify-center bg-black">
                {isVideo(active) ? (
                  <VideoPlayer src={resolveMediaUrl(active.fileUrl)} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveMediaUrl(active.fileUrl)}
                    alt={active.caption || active.tag || "Portfolio item"}
                    className="max-h-[75vh] w-full object-contain"
                  />
                )}
              </div>
              {(active.caption || active.tag) && (
                <div className="p-4">
                  {active.tag && <Badge variant="secondary" className="mb-1">{active.tag}</Badge>}
                  {active.caption && <p className="text-sm text-muted-foreground">{active.caption}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function VideoPlayer({ src }: { src: string }) {
  const [playbackError, setPlaybackError] = useState(false)

  if (playbackError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-background">
        <Video className="h-10 w-10 opacity-70" />
        <p className="text-sm">This video couldn&apos;t be played.</p>
      </div>
    )
  }

  return (
    <video
      src={src}
      controls
      autoPlay
      className="max-h-[75vh] w-full"
      onError={() => setPlaybackError(true)}
    />
  )
}
