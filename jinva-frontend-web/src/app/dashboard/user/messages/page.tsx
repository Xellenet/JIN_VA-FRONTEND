"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { MessagesPage } from "@/components/dashboard/messages-page"

/**
 * `?artisan=<userId>` opens that conversation; MC2's optional `&job=`/
 * `&booking=` carries the job/booking the customer came from, so the send
 * action can reference it and the thread header can show the context chip.
 */
function UserMessagesContent() {
  const searchParams = useSearchParams()
  const artisanId = searchParams.get("artisan") || undefined
  const jobId = searchParams.get("job") || undefined
  const bookingId = searchParams.get("booking") || undefined

  return <MessagesPage openConversationId={artisanId} jobId={jobId} bookingId={bookingId} />
}

export default function UserMessages() {
  return (
    <Suspense>
      <UserMessagesContent />
    </Suspense>
  )
}
