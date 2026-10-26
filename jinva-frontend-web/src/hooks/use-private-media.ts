"use client"

import { useEffect, useState } from "react"
import { apiFetchBlob } from "@/lib/api"

/**
 * QA MSG-18: message images and job/booking photos are private. They are
 * read through `GET /uploads/private/:folder/:filename`, which needs the
 * bearer header an `<img src>` can't send, so the bytes are fetched here and
 * shown from an object URL — the same approach as the admin KYC viewer.
 *
 * Accepts the stored reference ("/uploads/messages/<file>") and, for files
 * from before the change, an old full bucket URL ending in "/messages/<file>".
 */
export function privateMediaPath(reference: string | null | undefined): string | null {
  if (!reference) return null
  const m = /\/(messages|job-attachments)\/([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(reference.trim())
  return m ? `/uploads/private/${m[1]}/${m[2]}` : null
}

export type PrivateMediaStatus = "loading" | "ready" | "error"

export function usePrivateMedia(reference: string | null | undefined): {
  src: string | null
  status: PrivateMediaStatus
} {
  const [state, setState] = useState<{ src: string | null; status: PrivateMediaStatus }>({
    src: null,
    status: "loading",
  })

  useEffect(() => {
    const path = privateMediaPath(reference)
    if (!path) {
      setState({ src: null, status: "error" })
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    setState({ src: null, status: "loading" })
    apiFetchBlob(path)
      .then(({ blob }) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setState({ src: objectUrl, status: "ready" })
      })
      .catch(() => !cancelled && setState({ src: null, status: "error" }))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [reference])

  return state
}
