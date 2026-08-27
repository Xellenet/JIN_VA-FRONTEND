import type { Metadata } from "next"
import { NotFoundContent, notFoundMetadata } from "@/components/public/not-found-content"

/** Same title/robots treatment as the root boundary — see `src/app/not-found.tsx`. */
export const metadata: Metadata = notFoundMetadata

/**
 * Not-found boundary for a `notFound()` call from inside the `(public)` group.
 * `(public)/layout.tsx` already supplies the header and footer, so this renders
 * the body only. Unmatched URLs are handled by `src/app/not-found.tsx`.
 */
export default function PublicNotFound() {
  return <NotFoundContent />
}
