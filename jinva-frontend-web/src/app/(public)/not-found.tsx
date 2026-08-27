import { NotFoundContent } from "@/components/public/not-found-content"

/**
 * Not-found boundary for a `notFound()` call from inside the `(public)` group.
 * `(public)/layout.tsx` already supplies the header and footer, so this renders
 * the body only. Unmatched URLs are handled by `src/app/not-found.tsx`.
 */
export default function PublicNotFound() {
  return <NotFoundContent />
}
