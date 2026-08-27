"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FileText, Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiError, apiFetchBlob } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Reading a KYC identity document or selfie — api-contract.md §1.
 *
 * WHY THIS EXISTS RATHER THAN AN `<img src>`. `documentFrontUrl`,
 * `documentBackUrl` and `selfieUrl` are stored REFERENCES, not URLs. Nothing
 * serves `/uploads/documents/…` or `/uploads/selfies/…` any more, in either
 * storage mode, by design — that anonymous readability was the security round's
 * HIGH finding. The bytes now come from `GET /uploads/kyc/:folder/:filename`,
 * which is bearer-token + ADMIN guarded, and a browser image request carries no
 * `Authorization` header. So the only way to render one is to fetch it through
 * the authenticated helper and hand the blob to the DOM as an object URL.
 *
 * `resolveMediaUrl()` must NOT be used on these values — it rebuilds the old
 * dead `/uploads/documents/…` path. That helper stays correct for all five
 * public folders; KYC is the exception.
 */

/** `/uploads/documents/abc.jpg` → `/uploads/kyc/documents/abc.jpg`. */
export function kycMediaPath(storedRef: string): string | null {
  const m = /^\/?uploads\/(documents|selfies)\/([^/?#]+)$/.exec(storedRef.trim())
  if (!m) return null
  return `/uploads/kyc/${m[1]}/${m[2]}`
}

export interface KycMediaState {
  /** Object URL, once the bytes have arrived. Never a remote URL. */
  objectUrl: string | null
  contentType: string
  status: "loading" | "ready" | "error"
  /** User-facing message for the error state. */
  message: string
  /** False for 400/403/404 — the contract says those are not worth retrying. */
  retryable: boolean
}

const LOADING: KycMediaState = { objectUrl: null, contentType: "", status: "loading", message: "", retryable: false }

function describe(err: unknown): { message: string; retryable: boolean } {
  const status = err instanceof ApiError ? err.status : 0
  switch (status) {
    case 404:
      return { message: "This file is no longer available.", retryable: false }
    case 400:
      // A malformed path is a caller bug, not a user problem. Same tile as 404.
      console.error("[kyc-media] the request path was rejected as malformed", err)
      return { message: "This file is no longer available.", retryable: false }
    case 403:
      return { message: "You do not have access to this file.", retryable: false }
    default:
      return { message: "Couldn't load this file.", retryable: true }
  }
}

/**
 * Fetches every supplied stored reference once and keeps the object URLs alive
 * for as long as the component is mounted with that same set.
 *
 * All three tiles in the review dialog AND the full-size lightbox read from this
 * one map, so opening the lightbox re-uses bytes already fetched instead of
 * hitting an admin-audited endpoint a second time for the same object.
 */
export function useKycMedia(storedRefs: readonly (string | undefined)[]): {
  media: Record<string, KycMediaState>
  /** Re-fetches the whole set (at most three objects). */
  retry: () => void
} {
  const refs = storedRefs.filter((r): r is string => Boolean(r))
  const key = refs.join("|")
  const [media, setMedia] = useState<Record<string, KycMediaState>>({})
  const [attempt, setAttempt] = useState(0)
  // Revoke on unmount/change without making the effect depend on `media`.
  const created = useRef<string[]>([])

  useEffect(() => {
    let cancelled = false
    const list = key ? key.split("|") : []
    if (list.length === 0) {
      setMedia({})
      return
    }
    setMedia(Object.fromEntries(list.map((r) => [r, LOADING])))

    for (const ref of list) {
      const path = kycMediaPath(ref)
      if (!path) {
        console.error("[kyc-media] unrecognised stored reference shape:", ref)
        setMedia((m) => ({
          ...m,
          [ref]: { ...LOADING, status: "error", message: "This file is no longer available." },
        }))
        continue
      }
      apiFetchBlob(path)
        .then(({ blob, contentType }) => {
          if (cancelled) return
          const objectUrl = URL.createObjectURL(blob)
          created.current.push(objectUrl)
          setMedia((m) => ({
            ...m,
            [ref]: { objectUrl, contentType, status: "ready", message: "", retryable: false },
          }))
        })
        .catch((err) => {
          if (cancelled) return
          const { message, retryable } = describe(err)
          setMedia((m) => ({ ...m, [ref]: { ...LOADING, status: "error", message, retryable } }))
        })
    }

    return () => {
      cancelled = true
    }
  }, [key, attempt])

  // Revoked when the reviewed record changes and on unmount — NOT in the fetch
  // effect's cleanup, which also runs on `attempt` and would revoke a URL the
  // DOM is still displaying. React runs every cleanup before every effect, so
  // this always fires before the new set is fetched.
  useEffect(
    () => () => {
      for (const url of created.current) URL.revokeObjectURL(url)
      created.current = []
    },
    [key],
  )

  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  return { media, retry }
}

/** True for the content types that can go straight into an `<img>`. */
export function isKycImage(contentType: string): boolean {
  return contentType.startsWith("image/")
}

/**
 * One document tile: a fixed-ratio thumbnail with its own loading, error and
 * PDF states. A PDF cannot be thumbnailed without a renderer, so it shows a
 * labelled file affordance and stays clickable — the lightbox embeds it.
 */
export function KycMediaTile({
  state,
  label,
  onOpen,
  onRetry,
}: Readonly<{
  state: KycMediaState | undefined
  label: string
  onOpen: () => void
  onRetry: () => void
}>) {
  const s = state ?? LOADING
  const isImage = s.status === "ready" && isKycImage(s.contentType)

  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-muted">
      {s.status === "loading" && (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      )}

      {s.status === "error" && (
        <div className="flex flex-col items-center gap-1.5 px-2 text-center">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-[10px] leading-tight text-muted-foreground">{s.message}</p>
          {s.retryable && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onRetry}>
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          )}
        </div>
      )}

      {s.status === "ready" && (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "h-full w-full cursor-pointer",
            // `bg-black` behind the image, exactly as this tile rendered before
            // the endpoint change, so a scan with a light background still
            // reads as a document rather than bleeding into the dialog.
            isImage ? "bg-black" : "flex flex-col items-center justify-center gap-1.5",
          )}
          aria-label={`Open ${label} full size`}
        >
          {isImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={s.objectUrl ?? ""} alt={label} className="h-full w-full object-contain" />
          ) : (
            <>
              <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <span className="text-[10px] font-medium text-muted-foreground">PDF document</span>
            </>
          )}
        </button>
      )}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] text-white">
        {label}
      </span>
    </div>
  )
}

/** Full-size content for the lightbox: an image, or an embedded PDF. */
export function KycMediaFull({ state, label }: Readonly<{ state: KycMediaState; label: string }>) {
  if (state.status !== "ready" || !state.objectUrl) {
    return (
      <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {state.status === "loading" ? "Loading…" : state.message}
      </div>
    )
  }
  if (isKycImage(state.contentType)) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={state.objectUrl} alt={label} className="max-h-[80vh] w-full object-contain" />
  }
  return (
    <div className="flex h-[80vh] flex-col">
      <iframe src={state.objectUrl} title={label} className="h-full w-full border-0" />
    </div>
  )
}
