"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { MessagesPage } from "@/components/dashboard/messages-page"

/** A positive safe integer from a URL parameter, or undefined (SEC-19). */
function positiveIntParam(value: string | null): number | undefined {
  if (!value || !/^[1-9][0-9]{0,15}$/.test(value)) return undefined
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : undefined
}

/**
 * MC1 — `?client=<id>` deep link.
 *
 * `artisan/jobs/page.tsx` and `artisan/jobs/[id]/page.tsx` both link to
 * `/dashboard/artisan/messages?client=<customerId>`, but this wrapper used to
 * render `<MessagesPage />` with no props, so the param was silently dropped
 * and the link did nothing. Mirrors `user/messages/page.tsx`'s handling of
 * `?artisan=<id>`, including MC2's optional `&job=`/`&booking=` context.
 *
 * H5: `?conversation=<conversationId>` opens a conversation by its own id, as
 * the customer route does, so a message notification lands on its thread.
 */
function ArtisanMessagesContent() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("client") || undefined
  const jobId = searchParams.get("job") || undefined
  const bookingId = searchParams.get("booking") || undefined
  const conversationId = positiveIntParam(searchParams.get("conversation"))

  return (
    <MessagesPage
      openConversationId={clientId}
      jobId={jobId}
      bookingId={bookingId}
      openConversationRowId={conversationId}
    />
  )
}

export default function ArtisanMessages() {
  return (
    <Suspense>
      <ArtisanMessagesContent />
    </Suspense>
  )
}
