"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { MessagesPage } from "@/components/dashboard/messages-page"

/**
 * MC1 — `?client=<id>` deep link.
 *
 * `artisan/jobs/page.tsx` and `artisan/jobs/[id]/page.tsx` both link to
 * `/dashboard/artisan/messages?client=<customerId>`, but this wrapper used to
 * render `<MessagesPage />` with no props, so the param was silently dropped
 * and the link did nothing. Mirrors `user/messages/page.tsx`'s handling of
 * `?artisan=<id>`.
 */
function ArtisanMessagesContent() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("client") || undefined

  return <MessagesPage openConversationId={clientId} />
}

export default function ArtisanMessages() {
  return (
    <Suspense>
      <ArtisanMessagesContent />
    </Suspense>
  )
}
