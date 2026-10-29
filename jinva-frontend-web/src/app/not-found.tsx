import type { Metadata } from "next"
import { PublicHeader } from "@/components/public/public-header"
import { PublicFooter } from "@/components/public/public-footer"
import { NotFoundContent, notFoundMetadata } from "@/components/public/not-found-content"

/**
 * Without this the tab and the browser history entry for a dead link read
 * "JinVa — Find verified artisans", the root layout's default — indistinguishable
 * from the landing page.
 */
export const metadata: Metadata = notFoundMetadata

/**
 * The 404 any unmatched URL lands on — `/faq`, a stale link, a typo.
 *
 * This has to live at the root: a `not-found.tsx` inside a route group only
 * catches an explicit `notFound()` from within that group, NOT a URL that
 * matches no route at all. Without this file, `/faq` fell through to Next's bare
 * built-in 404 with no JinVa chrome and no way back.
 *
 * It renders the public header and footer itself, because no `(public)` layout
 * wraps a root not-found boundary.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <div className="flex-1">
        <NotFoundContent />
      </div>
      <PublicFooter />
    </div>
  )
}
