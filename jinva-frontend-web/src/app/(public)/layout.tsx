import type React from "react"
import { PublicHeader } from "@/components/public/public-header"
import { PublicFooter } from "@/components/public/public-footer"

/**
 * The shared public shell: header, page, footer, and nothing else
 * (design-spec.md §2 / §8.1).
 *
 * Deliberately imposes NO width constraint. The landing page needs full-bleed
 * sections; the four prose pages wrap themselves in `<PublicProse>`. Putting a
 * `max-w-*` here would break the first and be redundant for the second.
 *
 * `(public)` is a route group, so it contributes nothing to the URL — `/` still
 * lives at `/`, and `/about`, `/contact`, `/terms` and `/privacy` all sit
 * alongside it sharing this shell.
 */
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  )
}
