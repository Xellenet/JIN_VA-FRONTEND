"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"

/** The Profile page's tabs; `?from=` is honoured only for these. */
const PROFILE_TABS = ["about", "services", "portfolio", "reviews"] as const
const PROFILE_HREF = "/dashboard/artisan/profile"

/** Where "Back to editing" goes: the Profile, on the tab the preview was opened from. */
export function backToEditingHref(from: string | null | undefined): string {
  const tab = (PROFILE_TABS as readonly string[]).includes(from ?? "") ? from : null
  return tab && tab !== "about" ? `${PROFILE_HREF}?tab=${tab}` : PROFILE_HREF
}

function Banner({ href }: { href: string }) {
  return (
    // Sticky at the very top of the dashboard's scroll area (<main>; the negative
    // top cancels its padding, which sticky positioning measures from), edge to edge
    // across its padding, so the way back is always in reach.
    <section
      aria-label="Client preview"
      className="sticky -top-4 z-20 -mx-4 -mt-4 border-b border-primary/20 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:-top-6 md:-mx-6 md:-mt-6 md:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex"
            aria-hidden="true"
          >
            <Eye className="h-[18px] w-[18px]" />
          </span>
          <p className="min-w-0 text-sm text-foreground">
            <span className="font-medium">You&apos;re seeing your profile the way clients see it.</span>
            <span className="hidden text-muted-foreground md:inline">
              {" "}
              Clients also get Save, Message and Book here.
            </span>
          </p>
        </div>
        <Button asChild className="h-11 shrink-0">
          <Link href={href}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to editing
          </Link>
        </Button>
      </div>
    </section>
  )
}

function BannerFromQuery() {
  const from = useSearchParams().get("from")
  return <Banner href={backToEditingHref(from)} />
}

/**
 * Shown when an artisan opens "Preview as a client" on their own profile:
 * says it is a preview and offers one clear way back to editing, on the tab
 * they came from (`?from=services`, checked against the Profile's tabs).
 */
export function ProfilePreviewBanner() {
  return (
    <Suspense fallback={<Banner href={PROFILE_HREF} />}>
      <BannerFromQuery />
    </Suspense>
  )
}
